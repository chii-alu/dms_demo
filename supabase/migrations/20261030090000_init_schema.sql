-- MELA Intervention Manager: core schema (SPEC.md §3) with RLS baseline (§8).
-- Business rules that live in RPCs (§4) are added in later migrations.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Reference types
-- ---------------------------------------------------------------------------
create type pillar as enum ('HECO', 'HENT', 'HEMP');
create type intervention_type as enum ('open', 'selective');
create type session_kind as enum ('registration', 'application');
create type form_kind as enum ('intake', 'attendance', 'feedback');
create type form_status as enum ('draft', 'open', 'closed');
create type entry_status as enum (
  'registered', 'waitlisted', 'cancelled',                       -- open
  'applied', 'shortlisted', 'selected', 'rejected', 'withdrawn'  -- selective (+ waitlisted)
);
create type staff_role as enum ('admin', 'pillar_lead', 'pillar_staff', 'reviewer');

-- Sequences: session running number (form codes) and participant PID (MELA-####).
create sequence session_seq;
create sequence participant_pid_seq;

-- ---------------------------------------------------------------------------
-- Staff access (who may use the manager, and for which pillars)
-- ---------------------------------------------------------------------------
create table staff_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role staff_role not null,
  pillars pillar[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table interventions (
  id uuid primary key default gen_random_uuid(),
  pillar pillar not null,
  name text not null,
  type intervention_type not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pillar, name)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references interventions (id),
  pillar pillar not null,                          -- denormalised for RLS + reporting
  seq int not null default nextval('session_seq'), -- per-system running number, used in form codes
  kind session_kind not null,                      -- fixed at creation from intervention.type
  title text not null,
  dates date[] not null check (cardinality(dates) > 0), -- sorted, unique; enforced in create_session RPC
  mode text check (mode in ('In person', 'Online', 'Hybrid')),
  venue text,
  facilitator text,
  capacity int check (capacity is null or capacity >= 0),
  application_deadline date,
  completion_threshold numeric not null default 0.75 check (completion_threshold between 0 and 1),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table forms (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  kind form_kind not null,
  code text not null unique,                       -- e.g. HENT-M-004-REG / -APP / -ATT / -FBK
  status form_status not null default 'draft',
  questions jsonb not null default '[]' check (jsonb_typeof(questions) = 'array'), -- custom questions only (§5)
  unique (session_id, kind)
);

create table rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  name text not null,
  weight int not null check (weight between 0 and 100),
  position int
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  pid text unique not null default ('MELA-' || lpad(nextval('participant_pid_seq')::text, 4, '0')),
  email citext unique not null,
  name text not null,
  phone text,
  gender text,
  age_group text,
  country text,
  affiliation text,
  disability text,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table entries (                             -- registrations AND applications
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  participant_id uuid not null references participants (id),
  status entry_status not null,
  answers jsonb not null default '{}',             -- keyed by question id
  source text not null default 'self' check (source in ('self', 'staff', 'walkin')),
  submitted_at timestamptz not null default now(),
  unique (session_id, participant_id)
);

create table scores (
  entry_id uuid not null references entries (id) on delete cascade,
  criterion_id uuid not null references rubric_criteria (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id),
  score int not null check (score between 1 and 5),
  primary key (entry_id, criterion_id, reviewer_id)
);

create table attendance (
  session_id uuid not null references sessions (id) on delete cascade,
  participant_id uuid not null references participants (id),
  date date not null,
  checked_in_at timestamptz not null default now(),
  method text not null default 'self' check (method in ('self', 'staff', 'walkin')),
  primary key (session_id, participant_id, date)
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  participant_id uuid not null references participants (id),
  satisfaction int check (satisfaction between 1 and 5),
  relevance int check (relevance between 1 and 5),
  nps int check (nps between 0 and 10),
  most_useful text,
  improve text,
  answers jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  unique (session_id, participant_id)
);

create table status_history (                      -- audit trail for selection decisions
  id bigserial primary key,
  entry_id uuid not null references entries (id) on delete cascade,
  from_status entry_status,
  to_status entry_status not null,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now()
);

-- §4.15: every status change is written to status_history, whatever code path made it.
create function public.log_entry_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.status_history (entry_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger entries_status_history
after update of status on public.entries
for each row execute function public.log_entry_status();

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies can call them without
-- granting staff direct read access to staff_roles)
-- ---------------------------------------------------------------------------
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_roles r where r.user_id = (select auth.uid()));
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles r
    where r.user_id = (select auth.uid()) and r.role = 'admin'
  );
$$;

create function public.can_access_pillar(p public.pillar)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles r
    where r.user_id = (select auth.uid())
      and (r.role = 'admin' or p = any (r.pillars))
  );
$$;

create function public.can_access_session(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = sid and public.can_access_pillar(s.pillar)
  );
$$;

create function public.can_access_entry(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entries e
    where e.id = eid and public.can_access_session(e.session_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Public (anon) access gets no policies: public forms write only through
-- security-definer RPCs called from the server with the service role (§8).
-- ---------------------------------------------------------------------------
alter table staff_roles enable row level security;
alter table interventions enable row level security;
alter table sessions enable row level security;
alter table forms enable row level security;
alter table rubric_criteria enable row level security;
alter table participants enable row level security;
alter table entries enable row level security;
alter table scores enable row level security;
alter table attendance enable row level security;
alter table feedback enable row level security;
alter table status_history enable row level security;

-- Staff roles: a user can read their own row; only admins manage roles.
create policy staff_roles_read_own on staff_roles for select
  using (user_id = (select auth.uid()) or public.is_admin());
create policy staff_roles_admin_write on staff_roles for all
  using (public.is_admin()) with check (public.is_admin());

-- Interventions: any staff can read; only admins change them.
create policy interventions_staff_read on interventions for select
  using (public.is_staff());
create policy interventions_admin_write on interventions for all
  using (public.is_admin()) with check (public.is_admin());

-- Sessions: pillar-scoped.
create policy sessions_pillar_read on sessions for select
  using (public.can_access_pillar(pillar));
create policy sessions_pillar_write on sessions for all
  using (public.can_access_pillar(pillar)) with check (public.can_access_pillar(pillar));

-- Session children: scoped through the session's pillar.
create policy forms_pillar_all on forms for all
  using (public.can_access_session(session_id)) with check (public.can_access_session(session_id));
create policy rubric_pillar_all on rubric_criteria for all
  using (public.can_access_session(session_id)) with check (public.can_access_session(session_id));
create policy entries_pillar_all on entries for all
  using (public.can_access_session(session_id)) with check (public.can_access_session(session_id));
create policy attendance_pillar_all on attendance for all
  using (public.can_access_session(session_id)) with check (public.can_access_session(session_id));
create policy feedback_pillar_all on feedback for all
  using (public.can_access_session(session_id)) with check (public.can_access_session(session_id));
create policy scores_pillar_all on scores for all
  using (public.can_access_entry(entry_id)) with check (public.can_access_entry(entry_id));
create policy status_history_pillar_read on status_history for select
  using (public.can_access_entry(entry_id));

-- Participants: the registry is shared by all staff; only admins may delete (§8).
create policy participants_staff_read on participants for select
  using (public.is_staff());
create policy participants_staff_write on participants for insert
  with check (public.is_staff());
create policy participants_staff_update on participants for update
  using (public.is_staff()) with check (public.is_staff());
create policy participants_admin_delete on participants for delete
  using (public.is_admin());
