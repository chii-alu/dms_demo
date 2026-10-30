-- Pillar staff can read identity and standing for the people in their pillar (the agreed rule).
-- A person is "in a pillar" when they have a participation or an application in one of its cohorts.
-- Staff of other pillars still see only the non-identifying attributes.

create function public.is_pillar_participant(p_chii text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.participation p where p.chii_id = p_chii and public.can_access_cohort(p.cohort_id))
      or exists (select 1 from public.application a where a.chii_id = p_chii and public.can_access_cohort(a.cohort_id));
$$;

revoke execute on function public.is_pillar_participant(text) from public, anon;
grant execute on function public.is_pillar_participant(text) to authenticated;

create policy beneficiary_identity_pillar_read on beneficiary_identity for select
  using (public.is_pillar_participant(chii_id));

create policy student_standing_pillar_read on student_standing for select
  using (public.is_pillar_participant(chii_id));

-- The profile function uses the same rule, so the two cannot drift apart.
create or replace function public.person_profile(p_chii text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_person jsonb;
  v_identity jsonb;
  v_can_see_identity boolean;
  v_journey jsonb;
begin
  if not public.is_registry_staff() then
    raise exception 'Not allowed to view participant profiles' using errcode = '42501';
  end if;
  if p_chii is null or p_chii !~ '^CHII-[0-9]{6}$' then
    raise exception 'A CHII ID looks like CHII-000123' using errcode = '22023';
  end if;

  -- Follow a merge to the surviving ID, so old references still open the right person.
  select coalesce(b.merged_into, b.chii_id) into v_id from public.beneficiary b where b.chii_id = p_chii;
  if v_id is null then
    return null;
  end if;

  v_can_see_identity := public.is_admin() or public.is_pillar_participant(v_id);

  select jsonb_build_object(
    'chii_id', b.chii_id,
    'merged_from_requested', p_chii <> v_id,
    'gender', b.gender,
    'gender_identity', b.gender_identity,
    'nationality', b.nationality,
    'birth_country', b.birth_country,
    'residence_country', b.residence_country,
    'residence_city', b.residence_city,
    'humanitarian_status', b.humanitarian_status,
    'disability_status', b.disability_status
  ) into v_person
  from public.beneficiary b where b.chii_id = v_id;

  if v_can_see_identity then
    select jsonb_build_object('full_name', i.full_name, 'email', i.email::text, 'phone', i.phone, 'student_id', i.student_id)
      into v_identity
    from public.beneficiary_identity i where i.chii_id = v_id;
  else
    v_identity := jsonb_build_object('restricted', true);
  end if;

  select jsonb_build_object(
    'person', v_person,
    'identity', coalesce(v_identity, '{}'::jsonb),
    'identity_visible', v_can_see_identity,
    'types', coalesce((select jsonb_agg(jsonb_build_object('type', t.type, 'valid_from', t.valid_from, 'valid_to', t.valid_to)
                                   order by t.valid_from) from public.beneficiary_type t where t.chii_id = v_id), '[]'::jsonb),
    'student', (select jsonb_build_object('enrolment_status', sp.enrolment_status, 'year_group', sp.year_group,
                        'academic_programme', sp.academic_programme, 'institution', ins.name)
                from public.student_profile sp left join public.institution ins on ins.id = sp.institution_id
                where sp.chii_id = v_id),
    'standing', (select jsonb_build_object('financial', ss.financial_status, 'academic', ss.academic_status,
                          'disciplinary', ss.disciplinary_status)
                 from public.student_standing ss where ss.chii_id = v_id),
    'engagement', (select jsonb_build_object('opt_networking', e.opt_networking, 'opt_health_groups', e.opt_health_groups,
                          'remarks', e.remarks)
                   from public.engagement_profile e where e.chii_id = v_id)
  ) into v_journey;

  -- Journey: one row per cohort the person joined, with attendance and completion (addendum §7).
  v_journey := v_journey || jsonb_build_object('journey', coalesce((
    select jsonb_agg(jsonb_build_object(
      'pillar', j.pillar, 'intervention', j.intervention, 'cohort', j.cohort,
      'participation_status', j.participation_status, 'application_status', j.application_status,
      'sessions_attended', j.sessions_attended, 'sessions_total', j.sessions_total,
      'completed', j.completed, 'feedback_given', j.feedback_given,
      'placed', j.placed, 'awarded', j.awarded) order by j.cohort)
    from public.v_person_journey j where j.chii_id = v_id), '[]'::jsonb));

  return v_journey;
end;
$$;
