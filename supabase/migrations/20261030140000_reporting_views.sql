-- Milestone 6: reporting views for the dashboard (SPEC §3 "Reporting views", §8 dashboard_reader).
-- The views run as their owner, so the dashboard reader can aggregate across pillars. Staff
-- screens do not read these views (they compute the same numbers with RLS), and anon/authenticated
-- are revoked below so the aggregates are not exposed to the public or to pillar staff.

do $$
begin
  create role dashboard_reader nologin;
exception when duplicate_object then
  null;
end $$;

-- One row per session: status, intake and eligible counts, attendance, feedback, satisfaction, NPS.
-- Rates are percentages (0–100). Definitions match the session pipeline on the staff screens:
--   eligible       = open: registered; selective: selected
--   unique_attendees = distinct participants with any attendance record
--   attendance_rate  = unique_attendees / eligible (turnout)
--   response_rate    = feedback responses / unique_attendees
create view public.v_session_summary as
with ent as (
  select e.session_id,
         count(*) as intake_count,
         count(*) filter (
           where e.status = case when s.kind = 'application' then 'selected' else 'registered' end::public.entry_status
         ) as eligible_count
  from public.entries e
  join public.sessions s on s.id = e.session_id
  group by e.session_id
),
att as (
  select a.session_id, count(distinct a.participant_id) as unique_attendees
  from public.attendance a
  group by a.session_id
),
fb as (
  select f.session_id,
         count(*) as feedback_count,
         avg(f.satisfaction)::numeric(4, 2) as avg_satisfaction,
         avg(f.relevance)::numeric(4, 2) as avg_relevance,
         round(
           ((count(*) filter (where f.nps >= 9) - count(*) filter (where f.nps <= 6))::numeric / count(*)) * 100
         ) as nps
  from public.feedback f
  group by f.session_id
)
select
  s.id as session_id,
  s.pillar,
  i.name as intervention,
  s.title,
  (select min(d) from unnest(s.dates) d) as first_date,
  (select max(d) from unnest(s.dates) d) as last_date,
  case
    when (select max(d) from unnest(s.dates) d) < public.programme_today() then 'completed'
    when (select min(d) from unnest(s.dates) d) > public.programme_today() then 'upcoming'
    else 'in progress'
  end as status,
  coalesce(ent.intake_count, 0) as intake_count,
  coalesce(ent.eligible_count, 0) as eligible_count,
  coalesce(att.unique_attendees, 0) as unique_attendees,
  case when coalesce(ent.eligible_count, 0) = 0 then 0
       else round(coalesce(att.unique_attendees, 0)::numeric / ent.eligible_count * 100, 1) end as attendance_rate,
  coalesce(fb.feedback_count, 0) as feedback_count,
  case when coalesce(att.unique_attendees, 0) = 0 then 0
       else round(coalesce(fb.feedback_count, 0)::numeric / att.unique_attendees * 100, 1) end as response_rate,
  fb.avg_satisfaction,
  fb.avg_relevance,
  coalesce(fb.nps, 0) as nps
from public.sessions s
join public.interventions i on i.id = s.intervention_id
left join ent on ent.session_id = s.id
left join att on att.session_id = s.id
left join fb on fb.session_id = s.id;

-- One row per participant × session: entry status, dates attended, completion (§4.14), feedback given.
create view public.v_participant_activity as
select
  p.id as participant_id,
  p.pid,
  s.id as session_id,
  s.pillar,
  i.name as intervention,
  s.title as session_title,
  e.status as entry_status,
  coalesce(a.n, 0) as dates_attended,
  coalesce(a.n, 0) >= s.completion_threshold * cardinality(s.dates) as completed,
  exists (
    select 1 from public.feedback f where f.session_id = s.id and f.participant_id = p.id
  ) as feedback_given
from public.entries e
join public.participants p on p.id = e.participant_id
join public.sessions s on s.id = e.session_id
join public.interventions i on i.id = s.intervention_id
left join lateral (
  select count(*)::int as n from public.attendance at where at.session_id = s.id and at.participant_id = p.id
) a on true;

-- Unique participants per pillar, intervention and month of the session, split by the standard
-- demographic fields. Missing values show as 'Not given'.
create view public.v_reach_by_pillar as
select
  s.pillar,
  i.name as intervention,
  date_trunc('month', (select min(d) from unnest(s.dates) d))::date as month,
  coalesce(p.gender, 'Not given') as gender,
  coalesce(p.age_group, 'Not given') as age_group,
  coalesce(p.country, 'Not given') as country,
  coalesce(p.disability, 'Not given') as disability,
  count(distinct p.id) as participants
from public.entries e
join public.participants p on p.id = e.participant_id
join public.sessions s on s.id = e.session_id
join public.interventions i on i.id = s.intervention_id
group by s.pillar, i.name, month, gender, age_group, country, disability;

-- Selection funnel per selective session: applied → shortlisted → selected → attended → completed.
create view public.v_selection_funnel as
select
  s.id as session_id,
  s.pillar,
  i.name as intervention,
  s.title,
  count(e.id) as applied,
  count(e.id) filter (where e.status in ('shortlisted', 'selected')) as shortlisted,
  count(e.id) filter (where e.status = 'selected') as selected,
  count(e.id) filter (where e.status = 'selected' and att.n > 0) as attended,
  count(e.id) filter (
    where e.status = 'selected' and att.n >= s.completion_threshold * cardinality(s.dates)
  ) as completed
from public.sessions s
join public.interventions i on i.id = s.intervention_id
left join public.entries e on e.session_id = s.id
left join lateral (
  select count(*)::int as n from public.attendance a
  where a.session_id = s.id and a.participant_id = e.participant_id
) att on e.id is not null
where s.kind = 'application'
group by s.id, i.name;

grant usage on schema public to dashboard_reader;
grant execute on function public.programme_today() to dashboard_reader;
grant select on public.v_session_summary, public.v_participant_activity, public.v_reach_by_pillar, public.v_selection_funnel
  to dashboard_reader;

revoke all on public.v_session_summary, public.v_participant_activity, public.v_reach_by_pillar, public.v_selection_funnel
  from anon, authenticated;
