-- Milestone 5: staff attendance and walk-ins (SPEC §4.10 eligibility, §4.11 walk-ins, §4.12 feedback).
-- SECURITY INVOKER: RLS decides which sessions a staff member may change.

-- Eligible for attendance: open → registered; selective → selected (§4.10).
create function public.attendance_eligible_status(p_kind public.session_kind)
returns public.entry_status
language sql
immutable
set search_path = ''
as $$
  select case when p_kind = 'application' then 'selected'::public.entry_status else 'registered'::public.entry_status end;
$$;

-- Mark one eligible participant present (or absent) on one session date.
create function public.set_attendance(p_session_id uuid, p_participant_id uuid, p_date date, p_present boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.session_kind;
  v_dates date[];
  v_eligible public.entry_status;
begin
  select kind, dates into v_kind, v_dates from public.sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  if not (p_date = any (v_dates)) then
    raise exception 'That date is not one of the session dates' using errcode = '22023';
  end if;

  if p_present then
    v_eligible := public.attendance_eligible_status(v_kind);
    if not exists (
      select 1 from public.entries e
      where e.session_id = p_session_id and e.participant_id = p_participant_id and e.status = v_eligible
    ) then
      raise exception 'Only eligible participants can be marked present' using errcode = '22023';
    end if;
    insert into public.attendance (session_id, participant_id, date, method)
    values (p_session_id, p_participant_id, p_date, 'staff')
    on conflict (session_id, participant_id, date) do nothing;
  else
    delete from public.attendance
     where session_id = p_session_id and participant_id = p_participant_id and date = p_date;
  end if;
end;
$$;

-- Mark every eligible participant present on one date. Returns how many were newly marked.
create function public.mark_all_present(p_session_id uuid, p_date date)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.session_kind;
  v_dates date[];
  v_inserted int;
begin
  select kind, dates into v_kind, v_dates from public.sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  if not (p_date = any (v_dates)) then
    raise exception 'That date is not one of the session dates' using errcode = '22023';
  end if;

  insert into public.attendance (session_id, participant_id, date, method)
  select p_session_id, e.participant_id, p_date, 'staff'
  from public.entries e
  where e.session_id = p_session_id and e.status = public.attendance_eligible_status(v_kind)
  on conflict (session_id, participant_id, date) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- §4.11: a walk-in at an open session. Matches or creates the participant, records a
-- 'registered' entry with source 'walkin' (not subject to capacity), and marks them present on the date.
create function public.add_walkin(p_session_id uuid, p_profile jsonb, p_date date)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.session_kind;
  v_dates date[];
  v_email text;
  v_participant public.participants%rowtype;
begin
  select kind, dates into v_kind, v_dates from public.sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  if v_kind <> 'registration' then
    raise exception 'Walk-ins are only for open sessions' using errcode = '22023';
  end if;
  if not (p_date = any (v_dates)) then
    raise exception 'That date is not one of the session dates' using errcode = '22023';
  end if;

  v_email := lower(trim(coalesce(p_profile ->> 'email', '')));
  if v_email = '' or trim(coalesce(p_profile ->> 'name', '')) = '' then
    raise exception 'Name and email are required' using errcode = '22023';
  end if;

  insert into public.participants (email, name, phone, gender, age_group, country, affiliation, disability, consent_at)
  values (
    v_email, trim(p_profile ->> 'name'), p_profile ->> 'phone', p_profile ->> 'gender', p_profile ->> 'age',
    p_profile ->> 'country', p_profile ->> 'affiliation', p_profile ->> 'disability',
    case when p_profile ->> 'consent' = 'yes' then now() end
  )
  on conflict (email) do update set
    name = excluded.name,
    phone = coalesce(excluded.phone, public.participants.phone),
    gender = coalesce(excluded.gender, public.participants.gender),
    age_group = coalesce(excluded.age_group, public.participants.age_group),
    country = coalesce(excluded.country, public.participants.country),
    affiliation = coalesce(excluded.affiliation, public.participants.affiliation),
    disability = coalesce(excluded.disability, public.participants.disability),
    updated_at = now()
  returning * into v_participant;

  if exists (select 1 from public.attendance where session_id = p_session_id and participant_id = v_participant.id and date = p_date) then
    raise exception '% is already checked in for %.', v_participant.name, p_date using errcode = '23505';
  end if;

  -- Only create the entry if they are not already on the list.
  if not exists (select 1 from public.entries where session_id = p_session_id and participant_id = v_participant.id) then
    insert into public.entries (session_id, participant_id, status, answers, source)
    values (p_session_id, v_participant.id, 'registered', '{}'::jsonb, 'walkin');
  end if;

  insert into public.attendance (session_id, participant_id, date, method)
  values (p_session_id, v_participant.id, p_date, 'walkin');

  return jsonb_build_object('pid', v_participant.pid, 'name', v_participant.name);
end;
$$;

revoke execute on function public.attendance_eligible_status(public.session_kind) from public, anon;
revoke execute on function public.set_attendance(uuid, uuid, date, boolean) from public, anon;
revoke execute on function public.mark_all_present(uuid, date) from public, anon;
revoke execute on function public.add_walkin(uuid, jsonb, date) from public, anon;
grant execute on function public.attendance_eligible_status(public.session_kind) to authenticated;
grant execute on function public.set_attendance(uuid, uuid, date, boolean) to authenticated;
grant execute on function public.mark_all_present(uuid, date) to authenticated;
grant execute on function public.add_walkin(uuid, jsonb, date) to authenticated;
