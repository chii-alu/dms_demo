-- Replace a selective session's rubric in one transaction (SPEC §4.13 inputs).
-- SECURITY INVOKER: RLS on rubric_criteria decides who may edit.
create function public.replace_rubric(p_session_id uuid, p_criteria jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.session_kind;
begin
  select kind into v_kind from public.sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  if v_kind <> 'application' then
    raise exception 'Only selective sessions have a rubric' using errcode = '22023';
  end if;

  delete from public.rubric_criteria where session_id = p_session_id;

  insert into public.rubric_criteria (session_id, name, weight, position)
  select p_session_id, trim(c ->> 'name'), (c ->> 'weight')::int, ord::int
  from jsonb_array_elements(p_criteria) with ordinality as x(c, ord);
end;
$$;

revoke execute on function public.replace_rubric(uuid, jsonb) from public, anon;
grant execute on function public.replace_rubric(uuid, jsonb) to authenticated;
