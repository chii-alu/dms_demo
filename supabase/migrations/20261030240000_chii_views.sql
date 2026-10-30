-- CHII data model, part 4: reporting views (addendum §7). No restricted tables are read here.
-- Every total is COUNT(DISTINCT chii_id). Completion uses each cohort's threshold (default 75%).
-- Two names are reused from the old model (v_reach_by_pillar, v_selection_funnel). Those old views are
-- replaced here; v_session_summary and v_participant_activity are removed at step 7.
drop view if exists public.v_reach_by_pillar;
drop view if exists public.v_selection_funnel;

create view public.v_cohort_summary as
with sess as (
  select cohort_id, count(*)::int as n from public.session_meeting group by cohort_id
),
att as (
  select m.cohort_id, sa.chii_id, count(*)::int as n
  from public.session_attendance sa join public.session_meeting m on m.id = sa.session_id
  group by m.cohort_id, sa.chii_id
),
app as (
  select cohort_id,
         count(*)::int as applications,
         count(*) filter (where status in ('shortlisted', 'selected'))::int as shortlisted,
         count(*) filter (where status = 'selected')::int as selected
  from public.application group by cohort_id
),
part as (
  select cohort_id, count(distinct chii_id)::int as registered
  from public.participation where status in ('registered', 'selected') group by cohort_id
),
fb as (
  select cohort_id,
         count(*)::int as feedback_count,
         avg(satisfaction)::numeric(4, 2) as avg_satisfaction,
         avg(relevance)::numeric(4, 2) as avg_relevance,
         round(((count(*) filter (where nps >= 9) - count(*) filter (where nps <= 6))::numeric / nullif(count(*), 0)) * 100) as nps
  from public.cohort_feedback group by cohort_id
)
select
  c.id as cohort_id,
  i.pillar,
  i.name as intervention,
  c.label,
  c.start_date,
  coalesce(app.applications, 0) as applications,
  coalesce(app.shortlisted, 0) as shortlisted,
  coalesce(app.selected, 0) as selected,
  coalesce(part.registered, 0) as registered,
  (select count(distinct a.chii_id)::int from att a where a.cohort_id = c.id) as attended,
  (select count(*)::int from att a where a.cohort_id = c.id and coalesce(s.n, 0) > 0
     and a.n >= c.completion_threshold * s.n) as completed,
  coalesce(fb.feedback_count, 0) as feedback_count,
  fb.avg_satisfaction,
  fb.avg_relevance,
  coalesce(fb.nps, 0) as nps
from public.cohort c
join public.interventions i on i.id = c.intervention_id
left join sess s on s.cohort_id = c.id
left join app on app.cohort_id = c.id
left join part on part.cohort_id = c.id
left join fb on fb.cohort_id = c.id;

-- One row per person and cohort they took part in, with the person's whole journey in one query by CHII ID (R2).
create view public.v_person_journey as
select
  p.chii_id,
  i.pillar,
  i.name as intervention,
  c.id as cohort_id,
  c.label as cohort,
  p.status as participation_status,
  a.status as application_status,
  coalesce(pa.n, 0) as sessions_attended,
  coalesce(s.n, 0) as sessions_total,
  (coalesce(s.n, 0) > 0 and coalesce(pa.n, 0) >= c.completion_threshold * s.n) as completed,
  exists (select 1 from public.cohort_feedback f where f.chii_id = p.chii_id and f.cohort_id = c.id) as feedback_given,
  exists (select 1 from public.placement pl where pl.chii_id = p.chii_id and pl.cohort_id = c.id) as placed,
  exists (select 1 from public.funding_award fa where fa.chii_id = p.chii_id and fa.cohort_id = c.id) as awarded
from public.participation p
join public.cohort c on c.id = p.cohort_id
join public.interventions i on i.id = c.intervention_id
left join public.application a on a.chii_id = p.chii_id and a.cohort_id = c.id
left join lateral (
  select count(*)::int as n from public.session_attendance sa
  join public.session_meeting m on m.id = sa.session_id
  where sa.chii_id = p.chii_id and m.cohort_id = c.id
) pa on true
left join lateral (
  select count(*)::int as n from public.session_meeting m where m.cohort_id = c.id
) s on true;

-- Unique people by pillar, intervention, month and the standard demographic fields.
-- A person with two open types appears in two groups, so total from the funnel or summary views, not by adding rows.
create view public.v_reach_by_pillar as
select
  i.pillar,
  i.name as intervention,
  date_trunc('month', c.start_date)::date as month,
  coalesce(b.gender, 'Not given') as gender,
  coalesce(b.nationality_code, 'Not given') as nationality,
  coalesce(b.residence_country_code, 'Not given') as residence_country,
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

-- Selection funnel per selective cohort: applied -> reviewed -> selected -> attended -> completed.
create view public.v_selection_funnel as
select
  c.id as cohort_id,
  i.pillar,
  i.name as intervention,
  c.label,
  count(distinct a.chii_id) as applied,
  count(distinct a.chii_id) filter (where exists (select 1 from public.selection_review r where r.application_id = a.id)) as reviewed,
  count(distinct a.chii_id) filter (where a.status = 'selected') as selected,
  count(distinct a.chii_id) filter (where a.status = 'selected' and att.n > 0) as attended,
  count(distinct a.chii_id) filter (
    where a.status = 'selected' and coalesce(s.n, 0) > 0 and att.n >= c.completion_threshold * s.n
  ) as completed
from public.cohort c
join public.interventions i on i.id = c.intervention_id
join public.application a on a.cohort_id = c.id
left join lateral (
  select count(*)::int as n from public.session_meeting m where m.cohort_id = c.id
) s on true
left join lateral (
  select count(*)::int as n from public.session_attendance sa
  join public.session_meeting m on m.id = sa.session_id
  where m.cohort_id = c.id and sa.chii_id = a.chii_id
) att on true
group by c.id, i.id;

-- Views read by every staff member and the dashboard reader. Never anon.
revoke all on public.v_cohort_summary, public.v_person_journey, public.v_reach_by_pillar, public.v_selection_funnel from anon;
grant select on public.v_cohort_summary, public.v_person_journey, public.v_reach_by_pillar, public.v_selection_funnel to authenticated;
grant select on public.v_cohort_summary, public.v_person_journey, public.v_reach_by_pillar, public.v_selection_funnel to dashboard_reader;
