-- Admins manage staff access from the app (no SQL). Accounts are still created in Supabase Auth;
-- these functions only grant or change the staff role of an account that already exists.

create function public.list_staff()
returns table (user_id uuid, email text, role public.staff_role, pillars public.pillar[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see the staff list' using errcode = '42501';
  end if;
  return query
    select r.user_id, u.email::text, r.role, r.pillars
    from public.staff_roles r
    join auth.users u on u.id = r.user_id
    order by u.email;
end;
$$;

create function public.set_staff_role(p_email text, p_role public.staff_role, p_pillars public.pillar[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change staff access' using errcode = '42501';
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if not found then
    raise exception 'No account exists for %. Create it in Supabase Authentication first.', p_email using errcode = 'P0002';
  end if;

  -- Admins have every pillar, so the list is kept empty for them.
  insert into public.staff_roles (user_id, role, pillars)
  values (v_user, p_role, case when p_role = 'admin' then '{}' else coalesce(p_pillars, '{}') end)
  on conflict (user_id) do update set
    role = excluded.role,
    pillars = excluded.pillars;
end;
$$;

create function public.remove_staff(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove staff access' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot remove your own admin access' using errcode = '22023';
  end if;
  delete from public.staff_roles where user_id = p_user_id;
end;
$$;

revoke execute on function public.list_staff() from public, anon;
revoke execute on function public.set_staff_role(text, public.staff_role, public.pillar[]) from public, anon;
revoke execute on function public.remove_staff(uuid) from public, anon;
grant execute on function public.list_staff() to authenticated;
grant execute on function public.set_staff_role(text, public.staff_role, public.pillar[]) to authenticated;
grant execute on function public.remove_staff(uuid) to authenticated;
