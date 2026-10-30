-- Milestone 2: creating sessions with their forms, codes and rubric (SPEC §4.2, §4.3, §4.4).

-- Form-code initials, e.g. "Health Expert in Residence Programme" -> "HEIR", "Exposure & Networking" -> "EN".
-- Must match interventionInitials() in src/lib/rules/initials.ts (checked by tests).
create function public.intervention_initials(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(left(coalesce(string_agg(left(w.word, 1), '' order by w.ord), ''), 4))
  from regexp_split_to_table(trim(replace(p_name, '&', '')), '\s+') with ordinality as w(word, ord)
  where w.word <> '';
$$;

-- Creates a session, its three forms (intake, attendance, feedback) and, for
-- selective interventions, its rubric. Runs as the caller (SECURITY INVOKER), so
-- RLS decides whether they may create sessions in that pillar.
create function public.create_session(
  p_intervention_id uuid,
  p_title text,
  p_dates date[],
  p_mode text,
  p_venue text,
  p_facilitator text,
  p_capacity int,
  p_application_deadline date,
  p_intake_questions jsonb,
  p_feedback_questions jsonb,
  p_rubric jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_iv public.interventions%rowtype;
  v_kind public.session_kind;
  v_session_id uuid;
  v_seq int;
  v_base text;
  v_dates date[];
begin
  select * into v_iv from public.interventions where id = p_intervention_id and active;
  if not found then
    raise exception 'Intervention not found or inactive' using errcode = 'P0002';
  end if;
  if not public.can_access_pillar(v_iv.pillar) then
    raise exception 'Not allowed to create sessions for pillar %', v_iv.pillar using errcode = '42501';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Session title is required' using errcode = '22023';
  end if;

  -- §3: dates sorted and unique; at least one.
  select coalesce(array(select distinct d from unnest(p_dates) as d order by d), '{}') into v_dates;
  if cardinality(v_dates) = 0 then
    raise exception 'At least one session date is required' using errcode = '22023';
  end if;

  -- §4.4: kind is fixed from the intervention type at creation time.
  v_kind := case when v_iv.type = 'selective' then 'application' else 'registration' end;

  insert into public.sessions (
    intervention_id, pillar, kind, title, dates, mode, venue, facilitator,
    capacity, application_deadline, created_by
  )
  values (
    v_iv.id, v_iv.pillar, v_kind, trim(p_title), v_dates, p_mode, nullif(p_venue, ''), nullif(p_facilitator, ''),
    p_capacity, p_application_deadline, auth.uid()
  )
  returning id, seq into v_session_id, v_seq;

  -- §4.2: {PILLAR}-{INITIALS}-{SEQ:000}-{REG|APP|ATT|FBK}
  v_base := v_iv.pillar::text || '-' || public.intervention_initials(v_iv.name) || '-' || lpad(v_seq::text, 3, '0');

  insert into public.forms (session_id, kind, code, status, questions) values
    (v_session_id, 'intake', v_base || case when v_kind = 'application' then '-APP' else '-REG' end, 'draft',
      coalesce(p_intake_questions, '[]')),
    (v_session_id, 'attendance', v_base || '-ATT', 'draft', '[]'),
    (v_session_id, 'feedback', v_base || '-FBK', 'draft', coalesce(p_feedback_questions, '[]'));

  if v_kind = 'application' and p_rubric is not null then
    insert into public.rubric_criteria (session_id, name, weight, position)
    select v_session_id, trim(r ->> 'name'), (r ->> 'weight')::int, ord::int
    from jsonb_array_elements(p_rubric) with ordinality as x(r, ord);
  end if;

  return v_session_id;
end;
$$;

revoke execute on function public.create_session(uuid, text, date[], text, text, text, int, date, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.create_session(uuid, text, date[], text, text, text, int, date, jsonb, jsonb, jsonb)
  to authenticated;
