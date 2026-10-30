-- CHII data model, part 2: row level security (addendum §6, and the agreed visibility rules).
--   * Every staff member can read non-personal data across all pillars (aggregates, reference, person
--     attributes without identity).
--   * Pillar staff can read and write programme records (applications, participation, attendance,
--     feedback, placements, awards) only for cohorts of their own pillar.
--   * MELA admins are the data owners: only they read identity and student standing directly.
--   * Names for a pillar's own participants come through staff_cohort_people(), never through a view.
-- Public writes go through security-definer functions (resolve_beneficiary and the public form RPCs).

create function public.cohort_pillar(p_cohort_id uuid)
returns public.pillar
language sql
stable
security definer
set search_path = ''
as $$
  select i.pillar from public.cohort c join public.interventions i on i.id = c.intervention_id
  where c.id = p_cohort_id;
$$;

create function public.can_access_cohort(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_access_pillar(public.cohort_pillar(p_cohort_id));
$$;

create function public.can_access_session_meeting(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.session_meeting m where m.id = p_session_id and public.can_access_cohort(m.cohort_id));
$$;

-- Enable RLS on every new table.
alter table organisation enable row level security;
alter table institution enable row level security;
alter table beneficiary enable row level security;
alter table beneficiary_identity enable row level security;
alter table beneficiary_type enable row level security;
alter table student_profile enable row level security;
alter table student_standing enable row level security;
alter table beneficiary_interest enable row level security;
alter table engagement_profile enable row level security;
alter table cohort enable row level security;
alter table session_meeting enable row level security;
alter table application enable row level security;
alter table selection_review enable row level security;
alter table participation enable row level security;
alter table session_attendance enable row level security;
alter table cohort_feedback enable row level security;
alter table placement enable row level security;
alter table funding_award enable row level security;
alter table outcome enable row level security;
alter table venture enable row level security;
alter table venture_member enable row level security;
alter table venture_update enable row level security;
alter table id_match_review enable row level security;
alter table beneficiary_merge_log enable row level security;

-- Reference and person attributes (no identity).
create policy organisation_read on organisation for select using (public.is_staff());
create policy organisation_admin on organisation for all using (public.is_admin()) with check (public.is_admin());
create policy institution_read on institution for select using (public.is_staff());
create policy institution_admin on institution for all using (public.is_admin()) with check (public.is_admin());

create policy beneficiary_read on beneficiary for select using (public.is_registry_staff());
create policy beneficiary_admin on beneficiary for all using (public.is_admin()) with check (public.is_admin());
create policy beneficiary_type_read on beneficiary_type for select using (public.is_registry_staff());
create policy beneficiary_type_admin on beneficiary_type for all using (public.is_admin()) with check (public.is_admin());
create policy student_profile_read on student_profile for select using (public.is_registry_staff());
create policy student_profile_admin on student_profile for all using (public.is_admin()) with check (public.is_admin());
create policy beneficiary_interest_read on beneficiary_interest for select using (public.is_registry_staff());
create policy beneficiary_interest_admin on beneficiary_interest for all using (public.is_admin()) with check (public.is_admin());
create policy engagement_profile_read on engagement_profile for select using (public.is_registry_staff());
create policy engagement_profile_admin on engagement_profile for all using (public.is_admin()) with check (public.is_admin());

-- Restricted: data owner only.
create policy beneficiary_identity_admin on beneficiary_identity for all using (public.is_admin()) with check (public.is_admin());
create policy student_standing_admin on student_standing for all using (public.is_admin()) with check (public.is_admin());

-- Cohorts: all staff see the list of cohorts; only their pillar's staff change them.
create policy cohort_read on cohort for select using (public.is_staff());
create policy cohort_write on cohort for all
  using (public.can_access_cohort(id)) with check (public.can_access_pillar(public.cohort_pillar(id)));
create policy cohort_insert on cohort for insert
  with check (public.can_access_pillar((select i.pillar from public.interventions i where i.id = intervention_id)));

create policy session_meeting_read on session_meeting for select using (public.is_staff());
create policy session_meeting_write on session_meeting for all
  using (public.can_access_cohort(cohort_id)) with check (public.can_access_cohort(cohort_id));

-- Programme records: pillar only.
create policy application_pillar on application for all
  using (public.can_access_cohort(cohort_id)) with check (public.can_access_cohort(cohort_id));
create policy selection_review_pillar on selection_review for all
  using (exists (select 1 from public.application a where a.id = application_id and public.can_access_cohort(a.cohort_id)))
  with check (exists (select 1 from public.application a where a.id = application_id and public.can_access_cohort(a.cohort_id)));
create policy participation_pillar on participation for all
  using (public.can_access_cohort(cohort_id)) with check (public.can_access_cohort(cohort_id));
create policy session_attendance_pillar on session_attendance for all
  using (public.can_access_session_meeting(session_id)) with check (public.can_access_session_meeting(session_id));
create policy cohort_feedback_pillar on cohort_feedback for all
  using (public.can_access_cohort(cohort_id)) with check (public.can_access_cohort(cohort_id));
create policy placement_pillar on placement for all
  using (cohort_id is null or public.can_access_cohort(cohort_id))
  with check (cohort_id is null or public.can_access_cohort(cohort_id));
create policy funding_award_pillar on funding_award for all
  using (cohort_id is null or public.can_access_cohort(cohort_id))
  with check (cohort_id is null or public.can_access_cohort(cohort_id));

-- Outcomes and ventures: registry staff (not reviewers) maintain them.
create policy outcome_read on outcome for select using (public.is_registry_staff());
create policy outcome_write on outcome for all using (public.is_registry_staff()) with check (public.is_registry_staff());
create policy venture_read on venture for select using (public.is_registry_staff());
create policy venture_write on venture for all using (public.is_registry_staff()) with check (public.is_registry_staff());
create policy venture_member_read on venture_member for select using (public.is_registry_staff());
create policy venture_member_write on venture_member for all using (public.is_registry_staff()) with check (public.is_registry_staff());
create policy venture_update_read on venture_update for select using (public.is_registry_staff());
create policy venture_update_write on venture_update for all using (public.is_registry_staff()) with check (public.is_registry_staff());

-- Identity review and merges: admin only.
create policy id_match_review_admin on id_match_review for all using (public.is_admin()) with check (public.is_admin());
create policy beneficiary_merge_log_admin on beneficiary_merge_log for all using (public.is_admin()) with check (public.is_admin());
