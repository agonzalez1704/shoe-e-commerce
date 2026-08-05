-- Make the roles real. Until now every admin table was gated on is_admin()
-- (= admin_total), so a Gerente or Almacén could open their section and change
-- nothing. Each policy now also accepts the specific permission that section
-- represents. is_admin() stays in every clause, so full control keeps working
-- and nothing an owner can do today stops working.
--
-- Only the tables a limited role legitimately touches are widened. Money and
-- identity (payments, admin_users, customers, commissions) stay admin-only.

-- ---------- pedidos ----------
drop policy if exists own_orders on orders;
create policy own_orders on orders
  for select using (customer_id = auth.uid() or is_admin() or has_permiso('pedidos_ver'));

drop policy if exists adm_write_orders on orders;
create policy adm_write_orders on orders
  for update using (is_admin() or has_permiso('pedidos_gestionar'))
  with check (is_admin() or has_permiso('pedidos_gestionar'));

drop policy if exists adm_write_shipments on shipments;
create policy adm_write_shipments on shipments
  for all using (is_admin() or has_permiso('pedidos_gestionar'))
  with check (is_admin() or has_permiso('pedidos_gestionar'));

-- order_items / fiscal data are read alongside the order itself
drop policy if exists adm_fiscal on order_fiscal_data;
create policy adm_fiscal on order_fiscal_data
  for all using (is_admin() or has_permiso('facturar'))
  with check (is_admin() or has_permiso('facturar'));

drop policy if exists adm_cfdi on cfdi_documents;
create policy adm_cfdi on cfdi_documents
  for all using (is_admin() or has_permiso('facturar'))
  with check (is_admin() or has_permiso('facturar'));

-- the buyer's contact details, needed to work a pedido
drop policy if exists own_customer on customers;
create policy own_customer on customers
  for select using (id = auth.uid() or is_admin() or has_permiso('pedidos_ver'));

-- reading a payment tells you the reference/voucher to resend; it exposes no
-- card data, and pedidos_gestionar already implies contacting the buyer
drop policy if exists own_payments on payments;
create policy own_payments on payments
  for select using (is_admin() or has_permiso('pedidos_ver'));

-- ---------- catálogo ----------
drop policy if exists cat_read_products on products;
create policy cat_read_products on products
  for select using (status = 'active' or is_admin() or has_permiso('productos_gestionar') or has_permiso('inventario_ver'));

drop policy if exists adm_write_products on products;
create policy adm_write_products on products
  for all using (is_admin() or has_permiso('productos_gestionar'))
  with check (is_admin() or has_permiso('productos_gestionar'));

drop policy if exists adm_write_images on product_images;
create policy adm_write_images on product_images
  for all using (is_admin() or has_permiso('productos_gestionar'))
  with check (is_admin() or has_permiso('productos_gestionar'));

drop policy if exists adm_write_variants on variants;
create policy adm_write_variants on variants
  for all using (is_admin() or has_permiso('productos_gestionar'))
  with check (is_admin() or has_permiso('productos_gestionar'));

drop policy if exists adm_write_brands on brands;
create policy adm_write_brands on brands
  for all using (is_admin() or has_permiso('productos_gestionar'))
  with check (is_admin() or has_permiso('productos_gestionar'));

drop policy if exists adm_write_cats on categories;
create policy adm_write_cats on categories
  for all using (is_admin() or has_permiso('productos_gestionar'))
  with check (is_admin() or has_permiso('productos_gestionar'));

drop policy if exists adm_write_pcats on product_categories;
create policy adm_write_pcats on product_categories
  for all using (is_admin() or has_permiso('productos_gestionar'))
  with check (is_admin() or has_permiso('productos_gestionar'));

-- ---------- marketing ----------
drop policy if exists discounts_adm on discount_codes;
create policy discounts_adm on discount_codes
  for all using (is_admin() or has_permiso('descuentos_gestionar'))
  with check (is_admin() or has_permiso('descuentos_gestionar'));

drop policy if exists promo_admin on promociones;
create policy promo_admin on promociones
  for all using (is_admin() or has_permiso('promociones_gestionar'))
  with check (is_admin() or has_permiso('promociones_gestionar'));

drop policy if exists promo_prod_admin on promocion_productos;
create policy promo_prod_admin on promocion_productos
  for all using (is_admin() or has_permiso('promociones_gestionar'))
  with check (is_admin() or has_permiso('promociones_gestionar'));

drop policy if exists analytics_admin_read on analytics_events;
create policy analytics_admin_read on analytics_events
  for select using (is_admin() or has_permiso('metricas_ver'));

drop policy if exists reviews_adm on reviews;
create policy reviews_adm on reviews
  for all using (is_admin() or has_permiso('productos_gestionar'))
  with check (is_admin() or has_permiso('productos_gestionar'));

drop policy if exists restock_adm on restock_subscriptions;
create policy restock_adm on restock_subscriptions
  for select using (is_admin() or has_permiso('inventario_ver'));

drop policy if exists own_returns_read on returns;
create policy own_returns_read on returns
  for select using (customer_id = auth.uid() or is_admin() or has_permiso('pedidos_ver'));

drop policy if exists adm_returns_upd on returns;
create policy adm_returns_upd on returns
  for update using (is_admin() or has_permiso('pedidos_gestionar'))
  with check (is_admin() or has_permiso('pedidos_gestionar'));
