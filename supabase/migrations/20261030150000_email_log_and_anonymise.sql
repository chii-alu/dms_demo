-- Milestone 7: notification log (SPEC §9) and anonymise-on-request (SPEC §8).

create type email_status as enum ('sent', 'failed', 'not_configured');

-- Every templated email staff send is recorded here, whether or not it went out.
create table email_log (
  id bigserial primary key,
  entry_id uuid references entries (id) on delete set null,
  participant_id uuid references participants (id) on delete set null,
  to_email citext not null,
  subject text not null,
  body text not null,
  status email_status not null,
  provider_message_id text,
  error text,
  sent_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table email_log enable row level security;

-- Staff can read log rows for entries in pillars they can access. Writes go through the server
-- (which uses the signed-in user), so insert is limited to rows they can see.
create policy email_log_pillar_read on email_log for select
  using (entry_id is null or public.can_access_entry(entry_id));
create policy email_log_pillar_insert on email_log for insert
  with check (entry_id is null or public.can_access_entry(entry_id));

-- §8: anonymise a participant in place on request, so aggregate counts stay intact.
-- Admin only. Personal fields are replaced; the PID and the entries, attendance and feedback remain.
create function public.anonymise_participant(p_pid text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can anonymise a participant' using errcode = '42501';
  end if;

  select id into v_id from public.participants where pid = p_pid;
  if not found then
    raise exception 'Participant not found' using errcode = 'P0002';
  end if;

  update public.participants
     set name = 'Anonymised participant',
         email = 'anonymised+' || pid || '@invalid.local',
         phone = null,
         gender = null,
         age_group = null,
         country = null,
         affiliation = null,
         disability = null,
         consent_at = null,
         updated_at = now()
   where id = v_id;

  update public.email_log
     set to_email = 'anonymised@invalid.local', body = '[removed on request]'
   where participant_id = v_id;
end;
$$;

revoke execute on function public.anonymise_participant(text) from public, anon;
grant execute on function public.anonymise_participant(text) to authenticated;
