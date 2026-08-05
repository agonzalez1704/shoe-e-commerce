-- One row per colourway (model + colour) instead of one per size. A shoe
-- catalogue is 11 products × ~3 colours × 11 sizes = 363 variants, which as a
-- flat list is ten pages of near-identical rows. Grouped it's 33 cards, each
-- holding its sizes — the way stock is actually counted.
--
-- Aggregates come from the view so the page can sort and page on them without
-- pulling every variant first.
create or replace view public.admin_inventory_colorways
with (security_invoker = on) as
  select
    product_id,
    product_name,
    color,
    bool_or(made_to_order)      as made_to_order,
    count(*)::int               as tallas,
    sum(on_hand)::int           as on_hand,
    sum(reserved)::int          as reserved,
    sum(available)::int         as available,
    min(available)::int         as min_available,   -- the size closest to running out
    count(*) filter (where available = 0)::int as agotadas
  from public.admin_inventory
  group by product_id, product_name, color;

grant select on public.admin_inventory_colorways to authenticated;
revoke all on public.admin_inventory_colorways from anon;
