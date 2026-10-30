-- Legacy import: people without a usable name are imported too, so they get a CHII ID.
-- Their name is left blank and flagged for completion. A person already known by email keeps the name on record.
create or replace function public.import_legacy_batch(p_batch uuid)
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
  v_issue text;
  v_imported int := 0;
  v_rejected int := 0;
  v_no_name int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can import' using errcode = '42501';
  end if;

  for r in select row_no, raw from public.legacy_import_rows
           where batch_id = p_batch and status = 'pending' order by row_no loop
    v_raw := r.raw;
    v_email := public.normalise_email(v_raw ->> 'Email');
    v_name := nullif(trim(v_raw ->> 'Names'), '');
    v_issue := null;
    if v_name is null or lower(v_name) = 'unreported' then
      v_issue := 'name missing in the sheet (to complete)';
      v_no_name := v_no_name + 1;
    end if;

    begin
      v_type := case when v_raw ->> 'Enrollment Status' = 'Graduated' then 'alumni'
                     when v_raw ->> 'Enrollment Status' in ('Enrolled', 'Pending Graduation', 'Exited', 'Suspended') then 'student'
                     else null end;

      v_res := public.resolve_beneficiary(
        coalesce(v_name, v_email), v_email, null, public.legacy_id_or_null(v_raw ->> 'Student ID'), v_type,
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

      -- Created without a name: the email was only a placeholder, so clear it again.
      if v_name is null and (v_res ->> 'created')::boolean then
        update public.beneficiary_identity set full_name = '' where chii_id = v_chii;
      end if;

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

      update public.legacy_import_rows set status = 'imported', chii_id = v_chii, issue = v_issue
       where batch_id = p_batch and row_no = r.row_no;
      v_imported := v_imported + 1;
    exception when others then
      update public.legacy_import_rows set status = 'rejected', issue = sqlerrm
       where batch_id = p_batch and row_no = r.row_no;
      v_rejected := v_rejected + 1;
    end;
  end loop;

  update public.legacy_import_batches set status = 'imported' where id = p_batch;
  return jsonb_build_object('imported', v_imported, 'rejected', v_rejected, 'imported_without_name', v_no_name);
end;
$$;
