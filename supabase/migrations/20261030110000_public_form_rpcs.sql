-- Milestone 3: public form RPCs (SPEC §4.5–4.12).
-- Called from /api/forms/[code]/submit and /f/[code] with the anon key. They are
-- SECURITY DEFINER so anonymous visitors need no table grants, and each one
-- enforces the business rules itself rather than trusting the caller.

-- Today in the programme's timezone (Rwanda), for deadline checks.
create function public.programme_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Kigali')::date;
$$;

-- Public, read-only view of one form and its session. Returns null for unknown codes.
create function public.get_public_form(p_code text)
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

-- §4.5–4.9: intake (registration or application) with participant matching.
create function public.submit_intake(p_code text, p_profile jsonb, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
  v_email text;
  v_name text;
  v_participant public.participants%rowtype;
  v_returning boolean;
  v_count int;
  v_status public.entry_status;
begin
  select f.id, f.status, f.session_id, s.kind as session_kind, s.capacity, s.application_deadline
    into f
  from public.forms f
  join public.sessions s on s.id = f.session_id
  where f.code = p_code and f.kind = 'intake';
  if not found then
    raise exception 'Form not found' using errcode = 'P0002';
  end if;
  if f.status <> 'open' then
    raise exception 'This form is not accepting responses' using errcode = 'P0001';
  end if;
  if f.session_kind = 'application' and f.application_deadline is not null
     and public.programme_today() > f.application_deadline then
    raise exception 'Applications closed on %', f.application_deadline using errcode = 'P0001';
  end if;

  v_email := lower(trim(coalesce(p_profile ->> 'email', '')));
  v_name := trim(coalesce(p_profile ->> 'name', ''));
  if v_email = '' or v_name = '' then
    raise exception 'Name and email are required' using errcode = '22023';
  end if;
  if coalesce(p_profile ->> 'consent', '') <> 'yes' then
    raise exception 'Consent is needed to continue' using errcode = '22023';
  end if;

  -- Serialise submissions for this session so capacity and duplicate checks cannot race.
  perform 1 from public.sessions where id = f.session_id for update;

  -- §4.6: one participant per email, case-insensitive; reuse the PID.
  select * into v_participant from public.participants where email = v_email;
  v_returning := found;

  -- §4.7: one entry per participant per session.
  if v_returning and exists (
    select 1 from public.entries e where e.session_id = f.session_id and e.participant_id = v_participant.id
  ) then
    raise exception '% has already % for this session.', v_email,
      case when f.session_kind = 'application' then 'applied' else 'registered' end
      using errcode = '23505';
  end if;

  insert into public.participants (email, name, phone, gender, age_group, country, affiliation, disability, consent_at)
  values (
    v_email, v_name, p_profile ->> 'phone', p_profile ->> 'gender', p_profile ->> 'age',
    p_profile ->> 'country', p_profile ->> 'affiliation', p_profile ->> 'disability', now()
  )
  on conflict (email) do update set
    name = excluded.name,
    phone = excluded.phone,
    gender = excluded.gender,
    age_group = excluded.age_group,
    country = excluded.country,
    affiliation = excluded.affiliation,
    disability = excluded.disability,
    consent_at = excluded.consent_at,
    updated_at = now()
  returning * into v_participant;

  -- §4.8 and §4.9: applications are always 'applied'; registrations wait-list at capacity.
  if f.session_kind = 'application' then
    v_status := 'applied';
  else
    select count(*) into v_count from public.entries where session_id = f.session_id and status = 'registered';
    v_status := case when coalesce(f.capacity, 0) > 0 and v_count >= f.capacity then 'waitlisted' else 'registered' end;
  end if;

  insert into public.entries (session_id, participant_id, status, answers, source)
  values (f.session_id, v_participant.id, v_status, coalesce(p_answers, '{}'::jsonb), 'self');

  return jsonb_build_object('pid', v_participant.pid, 'status', v_status, 'returning', v_returning);
end;
$$;

-- §4.10: check-in. Email, date within the session, eligible, and not already checked in that day.
create function public.submit_checkin(p_code text, p_email text, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
  v_participant public.participants%rowtype;
  v_entry public.entries%rowtype;
  v_eligible public.entry_status;
begin
  select f.id, f.status, f.session_id, s.kind as session_kind, s.dates
    into f
  from public.forms f
  join public.sessions s on s.id = f.session_id
  where f.code = p_code and f.kind = 'attendance';
  if not found then
    raise exception 'Form not found' using errcode = 'P0002';
  end if;
  if f.status <> 'open' then
    raise exception 'This form is not accepting responses' using errcode = 'P0001';
  end if;

  select * into v_participant from public.participants where email = lower(trim(coalesce(p_email, '')));
  if not found then
    raise exception 'No participant found with that email. Register first, or ask staff to add you as a walk-in.'
      using errcode = 'P0001';
  end if;

  v_eligible := case when f.session_kind = 'application' then 'selected' else 'registered' end;
  select * into v_entry from public.entries where session_id = f.session_id and participant_id = v_participant.id;
  if not found or v_entry.status <> v_eligible then
    raise exception 'This email is not on the list for this session.' using errcode = 'P0001';
  end if;

  if not (p_date = any (f.dates)) then
    raise exception 'Choose one of the session dates.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.attendance a
    where a.session_id = f.session_id and a.participant_id = v_participant.id and a.date = p_date
  ) then
    raise exception '% is already checked in for %.', v_participant.name, p_date using errcode = '23505';
  end if;

  insert into public.attendance (session_id, participant_id, date, method)
  values (f.session_id, v_participant.id, p_date, 'self');

  return jsonb_build_object('pid', v_participant.pid, 'date', p_date);
end;
$$;

-- §4.12: feedback needs an attendance record for this session, and only one response per person.
create function public.submit_feedback(
  p_code text,
  p_email text,
  p_satisfaction int,
  p_relevance int,
  p_nps int,
  p_most_useful text,
  p_improve text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
  v_participant public.participants%rowtype;
begin
  select f.id, f.status, f.session_id
    into f
  from public.forms f
  where f.code = p_code and f.kind = 'feedback';
  if not found then
    raise exception 'Form not found' using errcode = 'P0002';
  end if;
  if f.status <> 'open' then
    raise exception 'This form is not accepting responses' using errcode = 'P0001';
  end if;

  select * into v_participant from public.participants where email = lower(trim(coalesce(p_email, '')));
  if not found or not exists (
    select 1 from public.attendance a where a.session_id = f.session_id and a.participant_id = v_participant.id
  ) then
    raise exception 'We have no attendance record for this email at this session, so feedback is not linked. Check the email used to register.'
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.feedback fb where fb.session_id = f.session_id and fb.participant_id = v_participant.id) then
    raise exception 'Feedback from this participant has already been recorded for this session.' using errcode = '23505';
  end if;

  insert into public.feedback (session_id, participant_id, satisfaction, relevance, nps, most_useful, improve, answers)
  values (f.session_id, v_participant.id, p_satisfaction, p_relevance, p_nps,
          nullif(p_most_useful, ''), nullif(p_improve, ''), coalesce(p_answers, '{}'::jsonb));

  return jsonb_build_object('pid', v_participant.pid);
end;
$$;

revoke execute on function public.programme_today() from public;
revoke execute on function public.get_public_form(text) from public;
revoke execute on function public.submit_intake(text, jsonb, jsonb) from public;
revoke execute on function public.submit_checkin(text, text, date) from public;
revoke execute on function public.submit_feedback(text, text, int, int, int, text, text, jsonb) from public;

grant execute on function public.programme_today() to anon, authenticated;
grant execute on function public.get_public_form(text) to anon, authenticated;
grant execute on function public.submit_intake(text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.submit_checkin(text, text, date) to anon, authenticated;
grant execute on function public.submit_feedback(text, text, int, int, int, text, text, jsonb) to anon, authenticated;
