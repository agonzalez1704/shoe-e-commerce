-- ============================================================
-- Postgres-native rate limiting (no external service). Fixed-window counter.
-- Pairs with the per-session pending-order cap (0011) for layered abuse defense.
-- ============================================================

create table rate_limits (
  bucket       text not null,
  identifier   text not null,        -- usually client IP
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (bucket, identifier, window_start)
);

-- not user-accessible: RLS on, no policies -> anon/authenticated denied.
-- check_rate_limit is security-definer; service_role bypasses RLS anyway.
alter table rate_limits enable row level security;

-- atomic bump-and-check. returns true = allowed, false = over limit.
create function public.check_rate_limit(
  p_bucket text, p_identifier text, p_max int, p_window_seconds int
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz;
  v_count  int;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits (bucket, identifier, window_start, count)
    values (p_bucket, p_identifier, v_window, 1)
    on conflict (bucket, identifier, window_start)
    do update set count = rate_limits.count + 1
    returning count into v_count;
  return v_count <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, text, int, int) from public, anon, authenticated;

-- housekeeping: drop stale windows hourly
create function public.cleanup_rate_limits()
returns void language sql security definer set search_path = public as $$
  delete from rate_limits where window_start < now() - interval '1 day';
$$;

select cron.schedule('cleanup-rate-limits', '17 * * * *', $$ select public.cleanup_rate_limits(); $$);
