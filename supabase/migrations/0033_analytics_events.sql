-- First-party web analytics: one row per pageview or tracked click. No PII —
-- just a random session id, the path, where the visit came from, and what was
-- clicked. Written only by the service role (via /api/track); read by admins.
create table if not exists analytics_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  session_id  text not null,
  type        text not null check (type in ('pageview', 'click')),
  path        text not null,
  referrer    text,
  source      text,   -- utm_source, else referring host, else 'directo'
  target      text,   -- click label (link/button text or href)
  device      text    -- 'mobile' | 'desktop'
);

create index if not exists analytics_created_idx on analytics_events (created_at);
create index if not exists analytics_type_created_idx on analytics_events (type, created_at);

alter table analytics_events enable row level security;
-- admins read; nobody gets an insert policy, so only the service role writes
create policy analytics_admin_read on analytics_events for select using (is_admin());

-- One call returns every breakdown the metrics page needs, aggregated in the DB.
create or replace function analytics_summary(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 90)));
  result json;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select json_build_object(
    'pageviews',    (select count(*) from analytics_events where type = 'pageview' and created_at >= since),
    'sessions',     (select count(distinct session_id) from analytics_events where created_at >= since),
    'clicks_total', (select count(*) from analytics_events where type = 'click' and created_at >= since),
    'top_pages', (select coalesce(json_agg(t), '[]') from (
      select path, count(*) n from analytics_events
      where type = 'pageview' and created_at >= since group by path order by n desc limit 12) t),
    'sources', (select coalesce(json_agg(t), '[]') from (
      select coalesce(nullif(source, ''), 'directo') source, count(*) n from analytics_events
      where type = 'pageview' and created_at >= since group by 1 order by n desc limit 12) t),
    'clicks', (select coalesce(json_agg(t), '[]') from (
      select target, count(*) n from analytics_events
      where type = 'click' and created_at >= since and target is not null and target <> ''
      group by target order by n desc limit 15) t),
    'devices', (select coalesce(json_agg(t), '[]') from (
      select coalesce(device, '?') device, count(*) n from analytics_events
      where type = 'pageview' and created_at >= since group by 1 order by n desc) t),
    'daily', (select coalesce(json_agg(t), '[]') from (
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') "day",
             count(*) filter (where type = 'pageview') n
      from analytics_events where created_at >= since group by 1 order by 1) t)
  ) into result;
  return result;
end $$;

grant execute on function analytics_summary(int) to authenticated;
