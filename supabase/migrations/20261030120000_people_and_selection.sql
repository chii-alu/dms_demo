-- Milestone 4: registrations and selection (SPEC §4.7, §4.8, §4.13, §4.15).
-- All three functions are SECURITY INVOKER: RLS decides which sessions a staff member may touch,
-- and each function checks the session kind and status rules itself.

-- Statuses allowed for each kind of session (SPEC §3 entry_status).
create function public.allowed_entry_statuses(p_kind public.session_kind)
returns public.entry_status[]
language sql
immutable
set search_path = ''
as $$
  select case when p_kind = 'registration'
    then array['registered', 'waitlisted', 'cancelled']::public.entry_status[]
    else array['applied', 'shortlisted', 'selected', 'waitlisted', 'rejected', 'withdrawn']::public.entry_status[]
  end;
$$;

-- Change the status of one or more entries in a session (used by per-row and bulk status changes).
create function public.set_entry_statuses(p_session_id uuid, p_entry_ids uuid[], p_status public.entry_status)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.session_kind;
  v_updated int;
begin
  select kind into v_kind from public.sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  if not (p_status = any (public.allowed_entry_statuses(v_kind))) then
    raise exception 'Status % is not used for this kind of session', p_status using errcode = '22023';
  end if;

  -- The trigger on entries writes status_history for every real change (§4.15).
  update public.entries
     set status = p_status
   where session_id = p_session_id and id = any (p_entry_ids) and status <> p_status;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- Replace the calling reviewer's scores for one entry. Criteria must belong to the entry's session.
create function public.save_scores(p_entry_id uuid, p_scores jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_kind public.session_kind;
begin
  select e.session_id, s.kind into v_session_id, v_kind
  from public.entries e join public.sessions s on s.id = e.session_id
  where e.id = p_entry_id;
  if not found then
    raise exception 'Entry not found' using errcode = 'P0002';
  end if;
  if v_kind <> 'application' then
    raise exception 'Only applications are scored' using errcode = '22023';
  end if;

  delete from public.scores
   where entry_id = p_entry_id and reviewer_id = auth.uid();

  insert into public.scores (entry_id, criterion_id, reviewer_id, score)
  select p_entry_id, (k ->> 'criterion_id')::uuid, auth.uid(), (k ->> 'score')::int
  from jsonb_array_elements(p_scores) as k
  join public.rubric_criteria rc
    on rc.id = (k ->> 'criterion_id')::uuid and rc.session_id = v_session_id;
end;
$$;

-- Staff add a registration or application by hand (SPEC §7 "Add manually").
-- Matches the participant by email (§4.6), refuses a second entry (§4.7),
-- and applies capacity to registrations (§4.8). Consent is recorded by the staff member.
create function public.staff_add_entry(p_session_id uuid, p_profile jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.session_kind;
  v_capacity int;
  v_email text;
  v_participant public.participants%rowtype;
  v_status public.entry_status;
  v_count int;
begin
  select kind, capacity into v_kind, v_capacity from public.sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  v_email := lower(trim(coalesce(p_profile ->> 'email', '')));
  if v_email = '' or trim(coalesce(p_profile ->> 'name', '')) = '' then
    raise exception 'Name and email are required' using errcode = '22023';
  end if;

  perform 1 from public.sessions where id = p_session_id for update;

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

  if exists (select 1 from public.entries where session_id = p_session_id and participant_id = v_participant.id) then
    raise exception '% already % this session.', v_email,
      case when v_kind = 'application' then 'applied to' else 'registered for' end
      using errcode = '23505';
  end if;

  if v_kind = 'application' then
    v_status := 'applied';
  else
    select count(*) into v_count from public.entries where session_id = p_session_id and status = 'registered';
    v_status := case when coalesce(v_capacity, 0) > 0 and v_count >= v_capacity then 'waitlisted' else 'registered' end;
  end if;

  insert into public.entries (session_id, participant_id, status, answers, source)
  values (p_session_id, v_participant.id, v_status, coalesce(p_profile -> 'answers', '{}'::jsonb), 'staff');

  return jsonb_build_object('pid', v_participant.pid, 'status', v_status);
end;
$$;

revoke execute on function public.allowed_entry_statuses(public.session_kind) from public, anon;
revoke execute on function public.set_entry_statuses(uuid, uuid[], public.entry_status) from public, anon;
revoke execute on function public.save_scores(uuid, jsonb) from public, anon;
revoke execute on function public.staff_add_entry(uuid, jsonb) from public, anon;
grant execute on function public.allowed_entry_statuses(public.session_kind) to authenticated;
grant execute on function public.set_entry_statuses(uuid, uuid[], public.entry_status) to authenticated;
grant execute on function public.save_scores(uuid, jsonb) to authenticated;
grant execute on function public.staff_add_entry(uuid, jsonb) to authenticated;
