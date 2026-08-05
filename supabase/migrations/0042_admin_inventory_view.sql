-- The admin inventory screen loaded every variant (363 and growing) and sorted
-- them in memory, so it could neither paginate nor filter. This view puts the
-- sku/size/colour/product and the availability arithmetic in one place, so the
-- page can filter, order and range entirely in the database.
--
-- security_invoker: the view runs with the CALLER's rights, so the RLS below
-- still decides who sees inventory. Without it a view silently bypasses RLS.
create or replace view public.admin_inventory
with (security_invoker = on) as
  select
    v.id                as variant_id,
    v.sku,
    v.size_value,
    v.size_system,
    v.width,
    v.color,
    v.status,
    p.id                as product_id,
    p.name              as product_name,
    p.made_to_order,
    coalesce(i.qty_on_hand, 0)  as on_hand,
    coalesce(i.qty_reserved, 0) as reserved,
    greatest(coalesce(i.qty_on_hand, 0) - coalesce(i.qty_reserved, 0), 0) as available
  from variants v
  join products p on p.id = v.product_id
  left join inventory i on i.variant_id = v.id;

grant select on public.admin_inventory to authenticated;

-- Let the roles that were given inventory permissions actually use them —
-- until now every read went through is_admin(), so an Almacén role could open
-- the page and see nothing.
drop policy if exists cat_read_inventory on inventory;
create policy cat_read_inventory on inventory
  for select using (is_admin() or has_permiso('inventario_ver'));

drop policy if exists adm_write_inventory on inventory;
create policy adm_write_inventory on inventory
  for all using (is_admin() or has_permiso('inventario_gestionar'))
  with check (is_admin() or has_permiso('inventario_gestionar'));

drop policy if exists cat_read_variants on variants;
create policy cat_read_variants on variants
  for select using (status = 'active' or is_admin() or has_permiso('inventario_ver'));

-- Supabase default-grants SELECT on new objects to anon; the underlying RLS
-- already nulls the quantities, but this view has no business being readable
-- from the storefront at all.
revoke all on public.admin_inventory from anon;
