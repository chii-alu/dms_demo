-- Per-session reviewers (SPEC §8: "reviewer: read applications + write own scores for assigned sessions").
-- Pillar staff and admins assign reviewers to a selective session. A reviewer sees and scores only
-- the applications of the sessions they are assigned to. Reviewers cannot change statuses or edit forms.

create table session_reviewers (
  session_id uuid not null references sessions (id) on delete cascade,
  user_id uuid not null references staff_roles (user_id) on delete cascade,
  assigned_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table session_reviewers enable row level security;

create function public.can_review_session(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.session_reviewers sr
    where sr.session_id = sid and sr.user_id = (select auth.uid())
  );
$$;

create function public.can_review_entry(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entries e
    where e.id = eid and public.can_review_session(e.session_id)
  );
$$;

-- Staff who can be assigned: anyone with a staff role. Used by the Reviewers card.
create function public.assignable_staff(p_session_id uuid)
returns table (user_id uuid, email text, role public.staff_role)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id, u.email::text, r.role
  from public.staff_roles r
  join auth.users u on u.id = r.user_id
  where public.can_access_session(p_session_id)
  order by u.email;
$$;

-- Who can see the assignments: the reviewer themselves, and anyone who can access the session.
create policy session_reviewers_read on session_reviewers for select
  using (user_id = (select auth.uid()) or public.can_access_session(session_id));

-- Only pillar staff and admins assign reviewers, and only to selective sessions.
create policy session_reviewers_manage on session_reviewers for all
  using (public.can_access_session(session_id))
  with check (
    public.can_access_session(session_id)
    and exists (select 1 from public.sessions s where s.id = session_id and s.kind = 'application')
  );

-- Reviewer read access, scoped to their assigned sessions.
create policy sessions_reviewer_read on sessions for select
  using (public.can_review_session(id));
create policy forms_reviewer_read on forms for select
  using (public.can_review_session(session_id));
create policy rubric_reviewer_read on rubric_criteria for select
  using (public.can_review_session(session_id));
create policy entries_reviewer_read on entries for select
  using (public.can_review_session(session_id));
create policy participants_reviewer_read on participants for select
  using (exists (
    select 1 from public.entries e
    where e.participant_id = participants.id and public.can_review_session(e.session_id)
  ));

-- Scores: a reviewer reads every score on their applications (to show the average) and writes only their own.
create policy scores_reviewer_read on scores for select
  using (public.can_review_entry(entry_id));
create policy scores_reviewer_write on scores for all
  using (reviewer_id = (select auth.uid()) and public.can_review_entry(entry_id))
  with check (reviewer_id = (select auth.uid()) and public.can_review_entry(entry_id));

-- The helpers are used inside RLS policies, so anon must be able to call them (they return false for anon).
revoke execute on function public.can_review_session(uuid) from public;
revoke execute on function public.can_review_entry(uuid) from public;
revoke execute on function public.assignable_staff(uuid) from public, anon;
grant execute on function public.can_review_session(uuid) to anon, authenticated;
grant execute on function public.can_review_entry(uuid) to anon, authenticated;
grant execute on function public.assignable_staff(uuid) to authenticated;

-- Reviewers must not read or write the whole registry (SPEC §8). Non-reviewer staff keep the old access;
-- reviewers see only participants with an entry in one of their sessions (policy above).
create function public.is_registry_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles r
    where r.user_id = (select auth.uid()) and r.role <> 'reviewer'
  );
$$;

drop policy participants_staff_read on participants;
drop policy participants_staff_write on participants;
drop policy participants_staff_update on participants;

create policy participants_staff_read on participants for select
  using (public.is_registry_staff());
create policy participants_staff_write on participants for insert
  with check (public.is_registry_staff());
create policy participants_staff_update on participants for update
  using (public.is_registry_staff()) with check (public.is_registry_staff());

revoke execute on function public.is_registry_staff() from public;
grant execute on function public.is_registry_staff() to anon, authenticated;
