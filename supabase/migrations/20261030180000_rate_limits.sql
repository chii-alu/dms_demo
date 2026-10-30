-- Shared rate limiting for public submissions (SPEC §8). Counts live in Postgres, so the limit holds
-- across every server instance. Anonymous callers reach it only through consume_rate_limit().
create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits int not null
);

alter table rate_limits enable row level security; -- no policies: nobody reads or writes it directly

-- Counts one hit for `p_key` and returns true while the hits in the current window are within `p_limit`.
create function public.consume_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke execute on function public.consume_rate_limit(text, int, int) from public;
grant execute on function public.consume_rate_limit(text, int, int) to anon, authenticated;
