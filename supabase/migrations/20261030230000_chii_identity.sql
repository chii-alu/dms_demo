-- CHII data model, part 3: identity (addendum §5, §6).
-- resolve_beneficiary() is the only way a person gets a CHII ID. Concurrency:
--   1. Every key the request carries (email, student ID, phone) becomes a transaction-scoped advisory lock.
--      The locks are taken in sorted order, so two requests for the same person queue up, and no two
--      requests can deadlock on each other's keys.
--   2. Lookup happens after the locks are held, so a second request sees the first one's row.
--   3. Unique indexes on normalised email and student ID are the backstop if anything gets past the locks.
--   4. Minting uses a sequence, so IDs never repeat. Rolled-back attempts leave gaps, which is acceptable.

-- ---------------------------------------------------------------------------
-- Normalisation (immutable, so they can back unique indexes)
-- ---------------------------------------------------------------------------
create function public.normalise_email(p text)
returns text language sql immutable set search_path = ''
as $$ select nullif(lower(trim(coalesce(p, ''))), '') $$;

create function public.normalise_student_id(p text)
returns text language sql immutable set search_path = ''
as $$ select nullif(upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')), '') $$;

create function public.normalise_phone(p text)
returns text language sql immutable set search_path = ''
as $$ select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '') $$;

create function public.normalise_name(p text)
returns text language sql immutable set search_path = ''
as $$ select nullif(lower(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g')), '') $$;

-- Unique backstops. Emails are stored normalised; the student ID index uses the normalised form.
create unique index beneficiary_identity_email_uniq on beneficiary_identity (email) where email is not null;
create unique index beneficiary_identity_student_uniq on beneficiary_identity (public.normalise_student_id(student_id))
  where public.normalise_student_id(student_id) is not null;

-- ---------------------------------------------------------------------------
-- Minting. Not callable by clients; only resolve_beneficiary() uses it.
-- ---------------------------------------------------------------------------
create function public.mint_chii_id()
returns text
language sql
security definer
set search_path = ''
as $$
  select 'CHII-' || lpad(nextval('public.chii_id_seq')::text, 6, '0');
$$;

revoke execute on function public.mint_chii_id() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- resolve_beneficiary: find the person or create them. Returns the CHII ID and what happened.
-- ---------------------------------------------------------------------------
create function public.resolve_beneficiary(
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

  -- 1. Serialise on every key this request carries (sorted, so concurrent requests cannot deadlock).
  if v_email is not null then v_keys := v_keys || hashtextextended('chii-email:' || v_email, 0); end if;
  if v_student is not null then v_keys := v_keys || hashtextextended('chii-student:' || v_student, 0); end if;
  if v_phone is not null then v_keys := v_keys || hashtextextended('chii-phone:' || v_phone, 0); end if;
  for v_key in select k from unnest(v_keys) as k order by k loop
    perform pg_advisory_xact_lock(v_key);
  end loop;

  -- 2. Exact match: student ID first, then email. Follow a merge to the surviving ID.
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

    -- Fill in what we did not have; never overwrite a value that is already on record.
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
      nationality_code = coalesce(nationality_code, p_profile ->> 'nationality_code'),
      birth_country_code = coalesce(birth_country_code, p_profile ->> 'birth_country_code'),
      residence_country_code = coalesce(residence_country_code, p_profile ->> 'residence_country_code'),
      residence_city = coalesce(residence_city, p_profile ->> 'residence_city'),
      disability_status = coalesce(disability_status, p_profile ->> 'disability_status'),
      updated_at = now()
    where chii_id = v_id;

    return jsonb_build_object('chii_id', v_id, 'created', false, 'match', 'exact');
  end if;

  -- 3. Weak match: same name and same phone but a different email or student ID. Still create a new
  --    ID, and queue the pair for MELA to confirm or merge (addendum §5).
  if v_phone is not null then
    select i.chii_id into v_weak
    from public.beneficiary_identity i
    join public.beneficiary b on b.chii_id = i.chii_id
    where public.normalise_phone(i.phone) = v_phone
      and public.normalise_name(i.full_name) = v_name
      and b.merged_into is null
    limit 1;
  end if;

  -- 4. Create the person.
  v_new := public.mint_chii_id();
  insert into public.beneficiary (chii_id, gender, nationality_code, birth_country_code, residence_country_code, residence_city, disability_status)
  values (
    v_new, p_profile ->> 'gender', p_profile ->> 'nationality_code', p_profile ->> 'birth_country_code',
    p_profile ->> 'residence_country_code', p_profile ->> 'residence_city', p_profile ->> 'disability_status'
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

revoke execute on function public.resolve_beneficiary(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.resolve_beneficiary(text, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Merge two CHII IDs (admin only). Every programme and outcome row moves to the surviving ID,
-- duplicates collapse, and the merged ID keeps a pointer so old references still resolve.
-- ---------------------------------------------------------------------------
create function public.merge_beneficiary(p_from text, p_into text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can merge people' using errcode = '42501';
  end if;
  if p_from = p_into then
    raise exception 'Choose two different CHII IDs' using errcode = '22023';
  end if;
  if not exists (select 1 from public.beneficiary where chii_id = p_from and merged_into is null)
     or not exists (select 1 from public.beneficiary where chii_id = p_into and merged_into is null) then
    raise exception 'Both CHII IDs must exist and be current' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('chii-merge:' || least(p_from, p_into), 0));
  perform pg_advisory_xact_lock(hashtextextended('chii-merge:' || greatest(p_from, p_into), 0));

  -- Applications and participation: drop duplicates for the same cohort, then move the rest.
  update public.participation set application_id = null
   where application_id in (
     select f.id from public.application f join public.application t
       on t.cohort_id = f.cohort_id and t.chii_id = p_into
     where f.chii_id = p_from);
  delete from public.application f using public.application t
   where f.chii_id = p_from and t.chii_id = p_into and f.cohort_id = t.cohort_id;
  update public.application set chii_id = p_into where chii_id = p_from;

  delete from public.participation f using public.participation t
   where f.chii_id = p_from and t.chii_id = p_into and f.cohort_id = t.cohort_id;
  update public.participation set chii_id = p_into where chii_id = p_from;

  delete from public.session_attendance f using public.session_attendance t
   where f.chii_id = p_from and t.chii_id = p_into and f.session_id = t.session_id;
  update public.session_attendance set chii_id = p_into where chii_id = p_from;

  delete from public.cohort_feedback f using public.cohort_feedback t
   where f.chii_id = p_from and t.chii_id = p_into and f.cohort_id = t.cohort_id;
  update public.cohort_feedback set chii_id = p_into where chii_id = p_from;

  delete from public.venture_member f using public.venture_member t
   where f.chii_id = p_from and t.chii_id = p_into and f.venture_id = t.venture_id;
  update public.venture_member set chii_id = p_into where chii_id = p_from;

  delete from public.beneficiary_interest f using public.beneficiary_interest t
   where f.chii_id = p_from and t.chii_id = p_into and f.interest = t.interest;
  update public.beneficiary_interest set chii_id = p_into where chii_id = p_from;

  delete from public.beneficiary_type f using public.beneficiary_type t
   where f.chii_id = p_from and t.chii_id = p_into and f.type = t.type and f.valid_to is null and t.valid_to is null;
  update public.beneficiary_type set chii_id = p_into where chii_id = p_from;

  -- Plain row moves.
  update public.placement set chii_id = p_into where chii_id = p_from;
  update public.funding_award set chii_id = p_into where chii_id = p_from;
  update public.outcome set chii_id = p_into where chii_id = p_from;
  update public.id_match_review set new_chii_id = p_into where new_chii_id = p_from;
  update public.id_match_review set candidate_chii_id = p_into where candidate_chii_id = p_from;

  -- One row per person: keep the surviving ID's row, or move the merged one if there is none.
  delete from public.student_profile where chii_id = p_from and exists (select 1 from public.student_profile where chii_id = p_into);
  update public.student_profile set chii_id = p_into where chii_id = p_from;
  delete from public.student_standing where chii_id = p_from and exists (select 1 from public.student_standing where chii_id = p_into);
  update public.student_standing set chii_id = p_into where chii_id = p_from;
  delete from public.engagement_profile where chii_id = p_from and exists (select 1 from public.engagement_profile where chii_id = p_into);
  update public.engagement_profile set chii_id = p_into where chii_id = p_from;
  -- Identity of the merged record is no longer needed once it is merged (data minimisation).
  delete from public.beneficiary_identity where chii_id = p_from;

  update public.beneficiary set merged_into = p_into, updated_at = now() where chii_id = p_from;
  insert into public.beneficiary_merge_log (from_chii_id, into_chii_id, merged_by) values (p_from, p_into, auth.uid());
end;
$$;

revoke execute on function public.merge_beneficiary(text, text) from public, anon;
grant execute on function public.merge_beneficiary(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Names for a cohort's participants, for pillar staff (addendum §6). Returns names only for cohorts
-- the caller can access, so the identity table itself stays admin-only.
-- ---------------------------------------------------------------------------
create function public.staff_cohort_people(p_cohort_id uuid)
returns table (chii_id text, full_name text, email text, participation_status text, application_status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_access_cohort(p_cohort_id) then
    raise exception 'Not allowed to see people in this cohort' using errcode = '42501';
  end if;
  return query
    select p.chii_id, i.full_name, i.email::text, p.status, a.status
    from public.participation p
    join public.beneficiary_identity i on i.chii_id = p.chii_id
    left join public.application a on a.chii_id = p.chii_id and a.cohort_id = p.cohort_id
    where p.cohort_id = p_cohort_id
    order by i.full_name;
end;
$$;

revoke execute on function public.staff_cohort_people(uuid) from public, anon;
grant execute on function public.staff_cohort_people(uuid) to authenticated;
