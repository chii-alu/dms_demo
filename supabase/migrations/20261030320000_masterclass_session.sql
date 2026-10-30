-- The Startup Finance masterclass as a platform session under HENT Masterclass, with the masterclass template as its
-- registration form (the same codes, forms and public link as every other session). Registrations are recorded on the
-- CHII tables against the session's cohort.

-- 1. Sessions link to their CHII cohort; intake forms can carry a template.
alter table public.sessions add column if not exists cohort_id uuid references public.cohort (id);
alter table public.forms add column if not exists template text check (template in ('masterclass_series'));

-- 2. Replace the standalone registration page and table with the session path.
drop function if exists public.submit_registration(text, jsonb, jsonb);
drop function if exists public.get_registration_form(text);
drop table if exists public.registration_form;

-- 3. The session, its forms and codes (same rules as create_session).
do $$
declare
  v_iv public.interventions%rowtype;
  v_cohort uuid;
  v_session uuid;
  v_seq int;
  v_base text;
begin
  select * into v_iv from public.interventions where name = 'Masterclass' and pillar = 'HENT' and active;
  if not found then
    raise exception 'The Masterclass intervention is missing from the catalogue';
  end if;
  select id into v_cohort from public.cohort where intervention_id = v_iv.id and label = 'Startup Finance 2026';
  if v_cohort is null then
    raise exception 'The Startup Finance 2026 cohort is missing';
  end if;
  if exists (select 1 from public.sessions where cohort_id = v_cohort) then
    return;
  end if;

  insert into public.sessions (intervention_id, pillar, kind, title, dates, mode, cohort_id)
  values (v_iv.id, v_iv.pillar, 'registration', 'Startup Finance 2026',
          array['2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20']::date[], 'Online', v_cohort)
  returning id, seq into v_session, v_seq;

  v_base := v_iv.pillar::text || '-' || public.intervention_initials(v_iv.name) || '-' || lpad(v_seq::text, 3, '0');

  insert into public.forms (session_id, kind, code, status, questions, template) values
    (v_session, 'intake', v_base || '-REG', 'open', $json$[{"id":"institution","label":"Which institution are you affiliated with?","type":"single","required":true,"options":["ALU","ALX","Other"]},{"id":"institution_other","label":"Name of your institution","type":"text","required":true,"showWhen":{"id":"institution","equals":["Other"]}},{"id":"student_email","label":"Student email address","type":"email","required":true,"showWhen":{"id":"institution","equals":["ALU"]},"emailDomains":["alustudent.com","alumni.alustudent.com"]},{"id":"personal_email","label":"Personal email address","type":"email","required":true},{"id":"whatsapp","label":"WhatsApp phone number (with country code, e.g. +250 784 650 219)","type":"text","required":true},{"id":"residence","label":"Which best describes the location of your primary residence?","type":"single","required":true,"options":["Rural","Urban","Peri Urban"]},{"id":"full_name","label":"Full name","type":"text","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"gender","label":"How do you describe your gender?","type":"single","required":true,"options":["Female","Male","Non-binary"],"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"year_of_birth","label":"Year of birth (yyyy)","type":"number","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"enrolment_status","label":"What is your enrolment status?","type":"single","required":true,"options":["Current student","Graduate"],"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"programme","label":"Program / area of study","type":"text","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"enrolment_year","label":"Enrolment year (yyyy)","type":"number","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"nationality","label":"Nationality","type":"text","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"country_of_residence","label":"Country of residence","type":"text","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"disability","label":"Do you identify as a person living with a disability?","type":"single","required":true,"options":["Yes","No"],"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"humanitarian","label":"Which of the following humanitarian statuses do you identify with?","type":"single","required":true,"options":["Refugee","Asylum seeker","Internally Displaced Person (IDP)","None"],"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"current_status","label":"Which best describes your current status?","type":"single","required":true,"options":["Wage Employment","Self-employed / Entrepreneur","Freelance","Unemployed","Student","Pursuing further education"],"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"consent","label":"I consent to my information being used to run this programme and for monitoring, evaluation and learning.","type":"consent","required":true},{"id":"sessions","label":"Which masterclasses would you like to register for?","type":"multi","required":true,"options":["Budgeting, Cash Flow & Startup Finance (Fri 30 Oct)","Financial Projections & Decision Making (Fri 6 Nov)","Funding Strategy & Investor/Grant Readiness (Fri 13 Nov)","Financial Storytelling, Pitching & Finance Clinic (Fri 20 Nov)"]},{"id":"knowledge","label":"How would you describe your current knowledge of startup finance?","type":"single","required":true,"options":["None: I have no experience with budgeting or financial planning","Beginner: I understand the basics","Intermediate: I have made a budget, cash flow plan or financial projection","Advanced: I regularly manage budgets, projections or fundraising for a venture"]},{"id":"hope","label":"What is one thing you hope to gain from this masterclass series?","type":"long","required":true}]$json$::jsonb, 'masterclass_series'),
    (v_session, 'attendance', v_base || '-ATT', 'draft', '[]', null),
    (v_session, 'feedback', v_base || '-FBK', 'draft', '[]', null);
end
$$;

-- 4. Public form data now says which template a form uses.
create or replace function public.get_public_form(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', f.code,
    'kind', f.kind,
    'status', f.status,
    'questions', f.questions,
    'template', f.template,
    'pillar', s.pillar,
    'intervention', i.name,
    'session', jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'kind', s.kind,
      'dates', s.dates,
      'mode', s.mode,
      'venue', s.venue,
      'application_deadline', s.application_deadline,
      'capacity', s.capacity
    ),
    'today', public.programme_today()
  )
  from public.forms f
  join public.sessions s on s.id = f.session_id
  join public.interventions i on i.id = s.intervention_id
  where f.code = p_code;
$$;

-- 5. Registration for a cohort: matches or creates the person, fills in what they did not have, and registers them.
create function public.register_for_cohort(p_cohort uuid, p_profile jsonb, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student text := lower(trim(coalesce(p_profile ->> 'student_email', '')));
  v_email text := lower(trim(coalesce(p_profile ->> 'email', '')));
  v_name text := trim(coalesce(p_profile ->> 'full_name', ''));
  v_phone text := nullif(trim(coalesce(p_profile ->> 'phone', '')), '');
  v_institution text := coalesce(p_profile ->> 'institution', '');
  v_id text;
  v_keys bigint[] := '{}';
  v_key bigint;
begin
  if coalesce(p_profile ->> 'consent', '') <> 'yes' then
    raise exception 'Consent is needed to continue' using errcode = '22023';
  end if;
  if v_email = '' then
    raise exception 'A personal email address is needed' using errcode = '22023';
  end if;
  if v_institution = 'ALU' and v_student = '' then
    raise exception 'A student email address is needed' using errcode = '22023';
  end if;

  -- Serialise on every key this request carries, so two submissions for one person cannot both create a record.
  if v_student <> '' then v_keys := v_keys || hashtextextended('chii-student:' || v_student, 0)::bigint; end if;
  v_keys := v_keys || hashtextextended('chii-email:' || v_email, 0)::bigint;
  for v_key in select k from unnest(v_keys) as k order by k loop
    perform pg_advisory_xact_lock(v_key);
  end loop;

  -- Match: student email first, then personal email. Follow a merge to the surviving ID.
  if v_student <> '' then
    select i.chii_id into v_id from public.beneficiary_identity i where i.student_email = v_student limit 1;
  end if;
  if v_id is null then
    select i.chii_id into v_id from public.beneficiary_identity i where i.email = v_email limit 1;
  end if;
  if v_id is not null then
    select coalesce(b.merged_into, b.chii_id) into v_id from public.beneficiary b where b.chii_id = v_id;
  end if;

  -- New person.
  if v_id is null then
    v_id := public.mint_chii_id();
    insert into public.beneficiary (chii_id) values (v_id);
    insert into public.beneficiary_identity (chii_id, full_name, email, student_email, phone)
    values (v_id, v_name, v_email, nullif(v_student, ''), v_phone);
    insert into public.beneficiary_type (chii_id, type) values (v_id, 'student');
  end if;

  -- Fill in what we did not have. Never overwrite a value that is already on record.
  update public.beneficiary_identity set
    full_name = case when full_name = '' then v_name else full_name end,
    phone = coalesce(phone, v_phone),
    student_email = coalesce(student_email, case when v_student <> '' and not exists (
      select 1 from public.beneficiary_identity o where o.student_email = v_student and o.chii_id <> v_id
    ) then v_student end),
    email = coalesce(email, case when not exists (
      select 1 from public.beneficiary_identity o where o.email = v_email and o.chii_id <> v_id
    ) then v_email end),
    updated_at = now()
  where chii_id = v_id;

  update public.beneficiary set
    gender = coalesce(gender, p_profile ->> 'gender'),
    nationality = coalesce(nationality, p_profile ->> 'nationality'),
    residence_country = coalesce(residence_country, p_profile ->> 'country_of_residence'),
    residence_area = coalesce(residence_area, p_profile ->> 'residence'),
    humanitarian_status = coalesce(humanitarian_status, p_profile ->> 'humanitarian'),
    disability_status = coalesce(disability_status, p_profile ->> 'disability'),
    updated_at = now()
  where chii_id = v_id;

  insert into public.student_profile (chii_id, enrolment_status, academic_programme)
  values (v_id, p_profile ->> 'enrolment_status', p_profile ->> 'programme')
  on conflict (chii_id) do update set
    enrolment_status = coalesce(public.student_profile.enrolment_status, excluded.enrolment_status),
    academic_programme = coalesce(public.student_profile.academic_programme, excluded.academic_programme),
    updated_at = now();

  -- One registration per person per cohort.
  if exists (select 1 from public.participation where chii_id = v_id and cohort_id = p_cohort) then
    raise exception 'This email is already registered for this masterclass series' using errcode = '23505';
  end if;

  insert into public.application (chii_id, cohort_id, answers, status)
  values (v_id, p_cohort, coalesce(p_answers, '{}'::jsonb), 'applied');
  insert into public.participation (chii_id, cohort_id, application_id, status)
  values (v_id, p_cohort, (select a.id from public.application a where a.chii_id = v_id and a.cohort_id = p_cohort), 'registered');

  -- The response is the same whether the person is new or already known.
  return jsonb_build_object('registered', true);
end;
$$;

revoke execute on function public.register_for_cohort(uuid, jsonb, jsonb) from public, anon, authenticated;

-- 6. The public registration for a masterclass session form.
create function public.submit_session_registration(p_code text, p_profile jsonb, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_template text;
  v_cohort uuid;
begin
  select f.status::text, f.template, s.cohort_id into v_status, v_template, v_cohort
  from public.forms f
  join public.sessions s on s.id = f.session_id
  where f.code = p_code and f.kind = 'intake';
  if not found then
    raise exception 'Form not found' using errcode = 'P0002';
  end if;
  if v_template is null then
    raise exception 'This form is not a masterclass registration' using errcode = '22023';
  end if;
  if v_status <> 'open' then
    raise exception 'This form is not accepting responses' using errcode = 'P0001';
  end if;
  if v_cohort is null then
    raise exception 'This session has no cohort' using errcode = 'P0002';
  end if;
  return public.register_for_cohort(v_cohort, p_profile, p_answers);
end;
$$;

revoke execute on function public.submit_session_registration(text, jsonb, jsonb) from public;
grant execute on function public.submit_session_registration(text, jsonb, jsonb) to anon, authenticated;
