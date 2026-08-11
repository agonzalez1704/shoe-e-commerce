-- Checkout instrumentation.
--
-- 66 sessions reached the checkout in a week and 17 created an order. The 49
-- who left produce no order, no payment and no error — the funnel can see the
-- hole but not its shape, so every explanation so far has been a guess.
--
-- Reuses analytics_events rather than adding a table: the ingest route, the
-- beacon and the session id already exist, and a checkout step is the same
-- shape as a click. `target` carries the step, optionally with a field:
--   start · method:card · invalid:neighborhood · submit · error:… · abandon:city
alter table analytics_events drop constraint if exists analytics_events_type_check;
alter table analytics_events add constraint analytics_events_type_check
  check (type in ('pageview', 'click', 'checkout'));

-- Where the checkout leaks, counted in the database.
--
-- `sesiones` is distinct sessions, not events: someone who fails validation
-- four times on the same field is one person stuck, not four data points, and
-- averaging them would overstate the problem.
create or replace function public.checkout_dropoff(p_days int default 7)
returns table (paso text, sesiones bigint, eventos bigint)
language sql
stable
security definer
set search_path = public
as $$
  select target as paso,
         count(distinct session_id) as sesiones,
         count(*)                   as eventos
    from analytics_events
   where type = 'checkout'
     and created_at >= now() - make_interval(days => p_days)
     and target is not null
   group by target
   order by count(distinct session_id) desc;
$$;

revoke all on function public.checkout_dropoff(int) from public, anon;
grant execute on function public.checkout_dropoff(int) to service_role;
