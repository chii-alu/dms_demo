-- Country names instead of codes (decision: maintain the country names as given).
-- The person tables are empty when this runs, so dropping the code columns loses no data.
drop view if exists public.v_reach_by_pillar;

alter table beneficiary
  drop column nationality_code,
  drop column birth_country_code,
  drop column residence_country_code,
  add column nationality text,
  add column birth_country text,
  add column residence_country text;

alter table institution
  drop column country_code,
  add column country text;

-- The reach view, on the name columns.
create view public.v_reach_by_pillar as
select
  i.pillar,
  i.name as intervention,
  date_trunc('month', c.start_date)::date as month,
  coalesce(b.gender, 'Not given') as gender,
  coalesce(b.nationality, 'Not given') as nationality,
  coalesce(b.residence_country, 'Not given') as residence_country,
  coalesce(b.disability_status, 'Not given') as disability,
  coalesce(b.humanitarian_status, 'Not given') as humanitarian_status,
  coalesce(bt.type, 'Not given') as beneficiary_type,
  count(distinct p.chii_id) as people
from public.participation p
join public.cohort c on c.id = p.cohort_id
join public.interventions i on i.id = c.intervention_id
join public.beneficiary b on b.chii_id = p.chii_id
left join public.beneficiary_type bt on bt.chii_id = p.chii_id and bt.valid_to is null
where b.merged_into is null
group by 1, 2, 3, 4, 5, 6, 7, 8, 9;

grant select on public.v_reach_by_pillar to authenticated, dashboard_reader;
revoke all on public.v_reach_by_pillar from anon;

-- resolve_beneficiary, updated for the name columns (same behaviour otherwise).
create or replace function public.resolve_beneficiary(
  p_full_name text,
  p_email text,
  p_phone text,
  p_student_id text,
  p_type text default null,
  p_profile jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.normalise_name(p_full_name);
  v_email text := public.normalise_email(p_email);
  v_phone text := public.normalise_phone(p_phone);
  v_student text := public.normalise_student_id(p_student_id);
  v_keys bigint[] := '{}';
  v_key bigint;
  v_id text;
  v_weak text;
  v_new text;
begin
  if v_name is null then
    raise exception 'Full name is required' using errcode = '22023';
  end if;
  if v_email is null and v_student is null and v_phone is null then
    raise exception 'An email, student ID or phone number is needed' using errcode = '22023';
  end if;

  if v_email is not null then v_keys := v_keys || hashtextextended('chii-email:' || v_email, 0); end if;
  if v_student is not null then v_keys := v_keys || hashtextextended('chii-student:' || v_student, 0); end if;
  if v_phone is not null then v_keys := v_keys || hashtextextended('chii-phone:' || v_phone, 0); end if;
  for v_key in select k from unnest(v_keys) as k order by k loop
    perform pg_advisory_xact_lock(v_key);
  end loop;

  select b.chii_id into v_id
  from public.beneficiary_identity i
  join public.beneficiary b on b.chii_id = i.chii_id
  where v_student is not null and public.normalise_student_id(i.student_id) = v_student
  limit 1;

  if v_id is null and v_email is not null then
    select b.chii_id into v_id
    from public.beneficiary_identity i
    join public.beneficiary b on b.chii_id = i.chii_id
    where i.email = v_email
    limit 1;
  end if;

  if v_id is not null then
    select coalesce(b.merged_into, b.chii_id) into v_id from public.beneficiary b where b.chii_id = v_id;

    update public.beneficiary_identity set
      phone = coalesce(phone, nullif(trim(coalesce(p_phone, '')), '')),
      student_id = coalesce(student_id, nullif(trim(coalesce(p_student_id, '')), '')),
      email = coalesce(email, case when v_email is not null and not exists (
        select 1 from public.beneficiary_identity o where o.email = v_email and o.chii_id <> v_id
      ) then v_email end),
      updated_at = now()
    where chii_id = v_id;

    update public.beneficiary set
      gender = coalesce(gender, p_profile ->> 'gender'),
      nationality = coalesce(nationality, p_profile ->> 'nationality'),
      birth_country = coalesce(birth_country, p_profile ->> 'birth_country'),
      residence_country = coalesce(residence_country, p_profile ->> 'residence_country'),
      residence_city = coalesce(residence_city, p_profile ->> 'residence_city'),
      disability_status = coalesce(disability_status, p_profile ->> 'disability_status'),
      updated_at = now()
    where chii_id = v_id;

    return jsonb_build_object('chii_id', v_id, 'created', false, 'match', 'exact');
  end if;

  if v_phone is not null then
    select i.chii_id into v_weak
    from public.beneficiary_identity i
    join public.beneficiary b on b.chii_id = i.chii_id
    where public.normalise_phone(i.phone) = v_phone
      and public.normalise_name(i.full_name) = v_name
      and b.merged_into is null
    limit 1;
  end if;

  v_new := public.mint_chii_id();
  insert into public.beneficiary (chii_id, gender, nationality, birth_country, residence_country, residence_city, disability_status)
  values (
    v_new, p_profile ->> 'gender', p_profile ->> 'nationality', p_profile ->> 'birth_country',
    p_profile ->> 'residence_country', p_profile ->> 'residence_city', p_profile ->> 'disability_status'
  );
  insert into public.beneficiary_identity (chii_id, full_name, email, phone, student_id)
  values (v_new, trim(p_full_name), v_email, nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_student_id, '')), ''));
  if p_type is not null then
    insert into public.beneficiary_type (chii_id, type) values (v_new, p_type);
  end if;
  if v_weak is not null then
    insert into public.id_match_review (new_chii_id, candidate_chii_id, reason)
    values (v_new, v_weak, 'Same name and phone as an existing person, but a different email or student ID');
  end if;

  return jsonb_build_object('chii_id', v_new, 'created', true, 'match', case when v_weak is null then 'none' else 'possible_duplicate' end);
end;
$$;

-- Placeholders in the sheet ("Unreported", "#N/A", blank) are not identifiers, so they never match anyone.
create function public.legacy_id_or_null(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when lower(trim(coalesce(p, ''))) in ('', 'unreported', '#n/a', 'n/a') then null else trim(p) end;
$$;

-- Import one staged batch "as it is". Admin only. Rows without a usable name are left for a decision
-- (resolve_beneficiary needs a name). Each row is processed on its own so one bad row does not stop the batch.
create function public.import_legacy_batch(p_batch uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_raw jsonb;
  v_name text;
  v_email text;
  v_type text;
  v_res jsonb;
  v_chii text;
  v_inst uuid;
  v_inst_name text;
  v_imported int := 0;
  v_rejected int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can import' using errcode = '42501';
  end if;

  for r in select row_no, raw from public.legacy_import_rows
           where batch_id = p_batch and status = 'pending' order by row_no loop
    v_raw := r.raw;
    v_name := nullif(trim(v_raw ->> 'Names'), '');
    v_email := public.normalise_email(v_raw ->> 'Email');

    begin
      if v_name is null or lower(v_name) = 'unreported' then
        raise exception 'no name in the sheet';
      end if;

      v_type := case when v_raw ->> 'Enrollment Status' = 'Graduated' then 'alumni'
                     when v_raw ->> 'Enrollment Status' in ('Enrolled', 'Pending Graduation', 'Exited', 'Suspended') then 'student'
                     else null end;

      v_res := public.resolve_beneficiary(
        v_name, v_email, null, public.legacy_id_or_null(v_raw ->> 'Student ID'), v_type,
        jsonb_build_object(
          'gender', nullif(trim(v_raw ->> 'Gender'), ''),
          'nationality', nullif(trim(v_raw ->> 'Nationality'), ''),
          'birth_country', nullif(trim(v_raw ->> 'Country of Birth'), ''),
          'residence_country', nullif(trim(v_raw ->> 'Country of Residence'), ''),
          'residence_city', nullif(trim(v_raw ->> 'City of Residence'), ''),
          'disability_status', nullif(trim(v_raw ->> 'Disability Status'), '')
        )
      );
      v_chii := v_res ->> 'chii_id';

      update public.beneficiary set
        gender_identity = coalesce(nullif(trim(v_raw ->> 'Gender Identity'), ''), gender_identity),
        humanitarian_status = coalesce(nullif(trim(v_raw ->> 'Has Humanitarian Status'), ''), humanitarian_status),
        updated_at = now()
      where chii_id = v_chii;

      v_inst_name := nullif(trim(v_raw ->> 'Primary Educational Institution'), '');
      v_inst := null;
      if v_inst_name is not null then
        insert into public.institution (name) values (v_inst_name) on conflict (name) do nothing;
        select id into v_inst from public.institution where name = v_inst_name;
      end if;

      insert into public.student_profile (chii_id, enrolment_status, year_group, academic_programme, institution_id)
      values (v_chii, nullif(trim(v_raw ->> 'Enrollment Status'), ''), nullif(trim(v_raw ->> 'Year Group'), ''),
              nullif(trim(v_raw ->> 'Primary Academic Program'), ''), v_inst)
      on conflict (chii_id) do update set
        enrolment_status = excluded.enrolment_status,
        year_group = excluded.year_group,
        academic_programme = excluded.academic_programme,
        institution_id = excluded.institution_id,
        updated_at = now();

      insert into public.student_standing (chii_id, financial_status, academic_status, disciplinary_status)
      values (v_chii, nullif(trim(v_raw ->> 'Financial Standing'), ''), nullif(trim(v_raw ->> 'Academic Standing'), ''),
              nullif(trim(v_raw ->> 'Disciplinary Standing'), ''))
      on conflict (chii_id) do update set
        financial_status = excluded.financial_status,
        academic_status = excluded.academic_status,
        disciplinary_status = excluded.disciplinary_status,
        updated_at = now();

      update public.legacy_import_rows set status = 'imported', chii_id = v_chii
       where batch_id = p_batch and row_no = r.row_no;
      v_imported := v_imported + 1;
    exception when others then
      update public.legacy_import_rows set status = 'rejected', issue = sqlerrm
       where batch_id = p_batch and row_no = r.row_no;
      v_rejected := v_rejected + 1;
    end;
  end loop;

  update public.legacy_import_batches set status = 'imported' where id = p_batch;
  return jsonb_build_object('imported', v_imported, 'rejected', v_rejected);
end;
$$;

revoke execute on function public.import_legacy_batch(uuid) from public, anon;
grant execute on function public.import_legacy_batch(uuid) to authenticated;
