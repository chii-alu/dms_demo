-- Masterclass registration on the CHII tables (addendum §5, §7).
-- A public registration form stored as data: its questions are JSON, so wording and branching can be edited
-- without a code change. Students are matched by student email, then personal email, and existing details are
-- never overwritten. The public responses do not reveal whether a person already exists.

-- 1. New fields on the person
alter table public.beneficiary add column if not exists residence_area text;
alter table public.beneficiary_identity add column if not exists student_email citext;
create unique index if not exists beneficiary_identity_student_email_uniq
  on public.beneficiary_identity (student_email) where student_email is not null;

-- 2. Registration forms
create table public.registration_form (
  code text primary key check (code ~ '^[a-z0-9-]+$'),
  title text not null,
  intro text not null default '',
  cohort_id uuid not null references public.cohort (id) on delete cascade,
  questions jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.registration_form enable row level security;
create policy registration_form_read on public.registration_form for select using (public.is_staff());
create policy registration_form_admin on public.registration_form for all using (public.is_admin()) with check (public.is_admin());

-- 3. The Masterclass cohort, its four sessions, and the registration form
do $$
declare
  v_intervention uuid;
  v_cohort uuid;
begin
  select id into v_intervention from public.interventions where name = 'Masterclass' and pillar = 'HENT';
  if v_intervention is null then
    raise exception 'The Masterclass intervention is missing from the catalogue';
  end if;

  select id into v_cohort from public.cohort where intervention_id = v_intervention and label = 'Startup Finance 2026';
  if v_cohort is null then
    insert into public.cohort (intervention_id, label, start_date, end_date, mode)
    values (v_intervention, 'Startup Finance 2026', '2026-10-30', '2026-11-20', 'Online')
    returning id into v_cohort;

    insert into public.session_meeting (cohort_id, session_date, title) values
      (v_cohort, '2026-10-30', 'Budgeting, Cash Flow & Startup Finance'),
      (v_cohort, '2026-11-06', 'Financial Projections & Decision Making'),
      (v_cohort, '2026-11-13', 'Funding Strategy & Investor/Grant Readiness'),
      (v_cohort, '2026-11-20', 'Financial Storytelling, Pitching & Finance Clinic');
  end if;

  insert into public.registration_form (code, title, intro, cohort_id, questions, status)
  values (
    'startup-finance-2026',
    'Masterclass Series: Startup Finance',
    $intro$The Centre for Health Innovation and Impact (CHII) invites students, founders, and emerging innovators to a practical masterclass series on startup finance.

Across four sessions, participants will learn to budget and manage cash flow, build financial projections to guide decisions, prepare for investors and grant funders, and tell a clear financial story when pitching.

Sessions:
Friday 30 October 2026: Budgeting, Cash Flow & Startup Finance (Mr. Geoffrey Karambizi)
Friday 6 November 2026: Financial Projections & Decision Making (Julian Ingabire Kayibanda)
Friday 13 November 2026: Funding Strategy & Investor/Grant Readiness (Julian Ingabire Kayibanda)
Friday 20 November 2026: Financial Storytelling, Pitching & Finance Clinic (Julian Ingabire Kayibanda)

Format: Online. Times: shared in your confirmation email.

Please complete this form to register for one or more sessions.$intro$,
    v_cohort,
    $json$[{"id":"institution","label":"Which institution are you affiliated with?","type":"single","required":true,"options":["ALU","ALX","Other"]},{"id":"institution_other","label":"Name of your institution","type":"text","required":true,"showWhen":{"id":"institution","equals":["Other"]}},{"id":"student_email","label":"Student email address","type":"email","required":true,"showWhen":{"id":"institution","equals":["ALU"]},"emailDomains":["alustudent.com","alumni.alustudent.com"]},{"id":"personal_email","label":"Personal email address","type":"email","required":true},{"id":"whatsapp","label":"WhatsApp phone number (with country code, e.g. +250 784 650 219)","type":"text","required":true},{"id":"residence","label":"Which best describes the location of your primary residence?","type":"single","required":true,"options":["Rural","Urban","Peri Urban"]},{"id":"full_name","label":"Full name","type":"text","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"gender","label":"How do you describe your gender?","type":"single","required":true,"options":["Female","Male","Non-binary"],"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"year_of_birth","label":"Year of birth (yyyy)","type":"number","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"enrolment_status","label":"What is your enrolment status?","type":"single","required":true,"options":["Current student","Graduate"],"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"programme","label":"Program / area of study","type":"text","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"enrolment_year","label":"Enrolment year (yyyy)","type":"number","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"nationality","label":"Nationality","type":"text","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"country_of_residence","label":"Country of residence","type":"text","required":true,"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"disability","label":"Do you identify as a person living with a disability?","type":"single","required":true,"options":["Yes","No"],"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"humanitarian","label":"Which of the following humanitarian statuses do you identify with?","type":"single","required":true,"options":["Refugee","Asylum seeker","Internally Displaced Person (IDP)","None"],"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"current_status","label":"Which best describes your current status?","type":"single","required":true,"options":["Wage Employment","Self-employed / Entrepreneur","Freelance","Unemployed","Student","Pursuing further education"],"showWhen":{"id":"institution","equals":["ALX","Other"]}},{"id":"consent","label":"I consent to my information being used to run this programme and for monitoring, evaluation and learning.","type":"consent","required":true},{"id":"sessions","label":"Which masterclasses would you like to register for?","type":"multi","required":true,"options":["Budgeting, Cash Flow & Startup Finance (Fri 30 Oct)","Financial Projections & Decision Making (Fri 6 Nov)","Funding Strategy & Investor/Grant Readiness (Fri 13 Nov)","Financial Storytelling, Pitching & Finance Clinic (Fri 20 Nov)"]},{"id":"knowledge","label":"How would you describe your current knowledge of startup finance?","type":"single","required":true,"options":["None: I have no experience with budgeting or financial planning","Beginner: I understand the basics","Intermediate: I have made a budget, cash flow plan or financial projection","Advanced: I regularly manage budgets, projections or fundraising for a venture"]},{"id":"hope","label":"What is one thing you hope to gain from this masterclass series?","type":"long","required":true}]$json$::jsonb,
    'open'
  )
  on conflict (code) do nothing;
end
$$;

-- 4. Public read: the form, its questions and its session dates. Nothing about registrants.
create function public.get_registration_form(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', f.code,
    'title', f.title,
    'intro', f.intro,
    'status', f.status,
    'questions', f.questions,
    'dates', coalesce((select jsonb_agg(m.session_date order by m.session_date) from public.session_meeting m where m.cohort_id = f.cohort_id), '[]'::jsonb)
  )
  from public.registration_form f
  where f.code = p_code;
$$;

-- 5. Public registration. Matches or creates the person, fills in what they did not have, and registers them.
create function public.submit_registration(p_code text, p_profile jsonb, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form public.registration_form%rowtype;
  v_student text := lower(trim(coalesce(p_profile ->> 'student_email', '')));
  v_email text := lower(trim(coalesce(p_profile ->> 'email', '')));
  v_name text := trim(coalesce(p_profile ->> 'full_name', ''));
  v_phone text := nullif(trim(coalesce(p_profile ->> 'phone', '')), '');
  v_institution text := coalesce(p_profile ->> 'institution', '');
  v_id text;
  v_keys bigint[] := '{}';
  v_key bigint;
begin
  select * into v_form from public.registration_form where code = p_code;
  if not found then
    raise exception 'This form does not exist' using errcode = 'P0002';
  end if;
  if v_form.status <> 'open' then
    raise exception 'This form is not accepting responses' using errcode = 'P0001';
  end if;
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
  if exists (select 1 from public.participation where chii_id = v_id and cohort_id = v_form.cohort_id) then
    raise exception 'This email is already registered for this masterclass series' using errcode = '23505';
  end if;

  insert into public.application (chii_id, cohort_id, answers, status)
  values (v_id, v_form.cohort_id, coalesce(p_answers, '{}'::jsonb), 'applied');
  insert into public.participation (chii_id, cohort_id, application_id, status)
  values (v_id, v_form.cohort_id, (select a.id from public.application a where a.chii_id = v_id and a.cohort_id = v_form.cohort_id), 'registered');

  -- The response is the same whether the person is new or already known.
  return jsonb_build_object('registered', true);
end;
$$;

revoke execute on function public.get_registration_form(text) from public;
revoke execute on function public.submit_registration(text, jsonb, jsonb) from public;
grant execute on function public.get_registration_form(text) to anon, authenticated;
grant execute on function public.submit_registration(text, jsonb, jsonb) to anon, authenticated;
