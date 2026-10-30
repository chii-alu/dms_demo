-- CHII data model, part 1: tables (CHII ID build addendum §3, §4).
-- Naming deviations from the addendum, because the app's old model already uses these names until
-- step 7 removes it: `session_attendance` (addendum: attendance), `cohort_feedback` (addendum: feedback).
-- The addendum's `session` (one meeting) is `session_meeting`, because `sessions` is the old table.
-- Pillar uses the existing `pillar` enum; interventions use the existing `interventions` table.

-- ---------------------------------------------------------------------------
-- Reference
-- ---------------------------------------------------------------------------
create table organisation (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null check (org_type in ('partner', 'employer', 'host', 'other')),
  created_at timestamptz not null default now(),
  unique (name)
);

create table institution (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code char(2) check (country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  unique (name)
);

-- interventions: the existing table gains the addendum's intake mode.
alter table interventions add column if not exists intake_mode text
  check (intake_mode in ('open', 'selective', 'registry'));
update interventions set intake_mode = type::text where intake_mode is null;

-- New interventions take their intake mode from their type unless one is given.
create function public.set_intake_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.intake_mode is null then
    new.intake_mode := new.type::text;
  end if;
  return new;
end;
$$;

create trigger interventions_intake_mode
before insert or update of type on public.interventions
for each row execute function public.set_intake_mode();

-- ---------------------------------------------------------------------------
-- CHII ID and identity sequence
-- ---------------------------------------------------------------------------
create sequence chii_id_seq start with 1;

-- ---------------------------------------------------------------------------
-- A. Person
-- ---------------------------------------------------------------------------
create table beneficiary (
  chii_id text primary key check (chii_id ~ '^CHII-[0-9]{6}$'),
  gender text,
  gender_identity text,
  nationality_code char(2) check (nationality_code ~ '^[A-Z]{2}$'),
  birth_country_code char(2) check (birth_country_code ~ '^[A-Z]{2}$'),
  residence_country_code char(2) check (residence_country_code ~ '^[A-Z]{2}$'),
  residence_city text,
  humanitarian_status text,
  disability_status text,
  merged_into text references beneficiary (chii_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RESTRICTED: names, contacts and student ID. Read by the data owner (admin) only.
create table beneficiary_identity (
  chii_id text primary key references beneficiary (chii_id),
  full_name text not null,
  email citext,
  phone text,
  student_id text,
  updated_at timestamptz not null default now()
);

create table beneficiary_type (
  id bigserial primary key,
  chii_id text not null references beneficiary (chii_id),
  type text not null check (type in ('student', 'alumni', 'founder', 'professional', 'public_servant', 'other')),
  valid_from date not null default current_date,
  valid_to date,
  check (valid_to is null or valid_to >= valid_from)
);
-- One open row per type and person.
create unique index beneficiary_type_open_idx on beneficiary_type (chii_id, type) where valid_to is null;

create table student_profile (
  chii_id text primary key references beneficiary (chii_id),
  enrolment_status text,
  year_group text,
  academic_programme text,
  institution_id uuid references institution (id),
  updated_at timestamptz not null default now()
);

-- RESTRICTED: financial, academic and disciplinary standing. Data owner (admin) only.
create table student_standing (
  chii_id text primary key references beneficiary (chii_id),
  financial_status text,
  academic_status text,
  disciplinary_status text,
  updated_at timestamptz not null default now()
);

create table beneficiary_interest (
  chii_id text not null references beneficiary (chii_id),
  interest text not null,
  primary key (chii_id, interest)
);

create table engagement_profile (
  chii_id text primary key references beneficiary (chii_id),
  opt_networking boolean not null default false,
  opt_health_groups boolean not null default false,
  remarks text
);

-- ---------------------------------------------------------------------------
-- B. Programme and activity
-- ---------------------------------------------------------------------------
create table cohort (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references interventions (id),
  label text not null,
  start_date date,
  end_date date,
  mode text check (mode in ('In person', 'Online', 'Hybrid')),
  venue text,
  facilitator text,
  capacity int check (capacity is null or capacity >= 0),
  application_deadline date,
  completion_threshold numeric not null default 0.75 check (completion_threshold between 0 and 1),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table session_meeting (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohort (id) on delete cascade,
  session_date date not null,
  title text,
  venue text,
  unique (cohort_id, session_date)
);

create table application (
  id uuid primary key default gen_random_uuid(),
  chii_id text not null references beneficiary (chii_id),
  cohort_id uuid not null references cohort (id) on delete cascade,
  answers jsonb not null default '{}',
  status text not null default 'applied' check (status in ('applied', 'shortlisted', 'selected', 'waitlisted', 'rejected', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  unique (chii_id, cohort_id)
);

create table selection_review (
  application_id uuid not null references application (id) on delete cascade,
  criterion text not null,
  reviewer_id uuid not null references auth.users (id),
  score int not null check (score between 1 and 5),
  decision text check (decision in ('shortlist', 'select', 'reject', 'waitlist')),
  reviewed_at timestamptz not null default now(),
  primary key (application_id, criterion, reviewer_id)
);

create table participation (
  id uuid primary key default gen_random_uuid(),
  chii_id text not null references beneficiary (chii_id),
  cohort_id uuid not null references cohort (id) on delete cascade,
  application_id uuid references application (id),
  status text not null check (status in ('registered', 'waitlisted', 'cancelled', 'selected', 'withdrawn')),
  registered_on date not null default current_date,
  unique (chii_id, cohort_id)
);

create table session_attendance (
  session_id uuid not null references session_meeting (id) on delete cascade,
  chii_id text not null references beneficiary (chii_id),
  checked_in_at timestamptz not null default now(),
  method text not null default 'self' check (method in ('self', 'staff', 'walkin')),
  primary key (session_id, chii_id)
);

create table cohort_feedback (
  id uuid primary key default gen_random_uuid(),
  chii_id text not null references beneficiary (chii_id),
  cohort_id uuid not null references cohort (id) on delete cascade,
  satisfaction int check (satisfaction between 1 and 5),
  relevance int check (relevance between 1 and 5),
  nps int check (nps between 0 and 10),
  most_useful text,
  improve text,
  answers jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  unique (chii_id, cohort_id)
);

create table placement (
  id uuid primary key default gen_random_uuid(),
  chii_id text not null references beneficiary (chii_id),
  cohort_id uuid references cohort (id) on delete set null,
  kind text not null check (kind in ('internship', 'sie_host')),
  organisation_id uuid references organisation (id),
  starts_on date,
  ends_on date
);

create table funding_award (
  id uuid primary key default gen_random_uuid(),
  chii_id text not null references beneficiary (chii_id),
  cohort_id uuid references cohort (id) on delete set null,
  amount numeric(14, 2),
  currency char(3),
  awarded_on date
);

-- ---------------------------------------------------------------------------
-- C. Outcomes and ventures
-- ---------------------------------------------------------------------------
create table outcome (
  id uuid primary key default gen_random_uuid(),
  chii_id text not null references beneficiary (chii_id),
  kind text not null check (kind in ('job', 'study', 'internship')),
  organisation_id uuid references organisation (id),
  started_on date,
  notes text
);

create table venture (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stage text,
  intervention_id uuid references interventions (id),
  created_at timestamptz not null default now()
);

create table venture_member (
  venture_id uuid not null references venture (id) on delete cascade,
  chii_id text not null references beneficiary (chii_id),
  role text not null check (role in ('founder', 'member')),
  primary key (venture_id, chii_id)
);

create table venture_update (
  id uuid primary key default gen_random_uuid(),
  venture_id uuid not null references venture (id) on delete cascade,
  update_date date not null default current_date,
  jobs_created int check (jobs_created is null or jobs_created >= 0),
  revenue numeric(14, 2),
  notes text
);

-- ---------------------------------------------------------------------------
-- App operations for identity (no personal data beyond the IDs)
-- ---------------------------------------------------------------------------
create table id_match_review (
  id bigserial primary key,
  new_chii_id text not null references beneficiary (chii_id),
  candidate_chii_id text not null references beneficiary (chii_id),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'confirmed_same', 'confirmed_different')),
  created_at timestamptz not null default now()
);

create table beneficiary_merge_log (
  id bigserial primary key,
  from_chii_id text not null,
  into_chii_id text not null references beneficiary (chii_id),
  merged_by uuid references auth.users (id),
  merged_at timestamptz not null default now()
);
