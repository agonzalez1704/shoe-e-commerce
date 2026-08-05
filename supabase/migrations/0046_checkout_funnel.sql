-- Checkout funnel, counted in the database.
--
-- Doing this from the client meant pulling the events and grouping them in JS,
-- but PostgREST caps a response at 1000 rows: with ~17k events a month the
-- funnel was computed from an arbitrary slice and read as "1 session reached
-- checkout" while 28 orders existed. COUNT(DISTINCT ...) belongs in SQL.
create or replace function public.checkout_funnel(p_desde timestamptz)
returns table (
  visitantes            bigint,
  vieron_producto       bigint,
  llegaron_al_carrito   bigint,
  llegaron_al_checkout  bigint,
  pedidos_creados       bigint,
  pedidos_pagados       bigint
)
language sql stable security definer set search_path = public as $$
  select
    (select count(distinct session_id) from analytics_events where created_at >= p_desde),
    (select count(distinct session_id) from analytics_events where created_at >= p_desde and path like '%/products/%'),
    (select count(distinct session_id) from analytics_events where created_at >= p_desde and path like '%/cart%'),
    (select count(distinct session_id) from analytics_events where created_at >= p_desde and path like '%/checkout%'),
    (select count(*) from orders where created_at >= p_desde),
    (select count(*) from orders where created_at >= p_desde and status in ('paid','fulfilled'));
$$;

revoke all on function public.checkout_funnel(timestamptz) from public, anon;
grant execute on function public.checkout_funnel(timestamptz) to service_role;
