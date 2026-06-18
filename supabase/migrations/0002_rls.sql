-- ============================================================
-- Phase 0 — Row Level Security. Default deny; grant narrowly.
-- Rule of thumb:
--   catalog  -> public read (active only), admin write
--   customer -> owner read/write own rows
--   orders   -> owner read; writes go through service role / RPC
-- ============================================================

-- admin helper (security definer to avoid RLS recursion on admin_users)
create function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- enable RLS everywhere
alter table customers             enable row level security;
alter table addresses             enable row level security;
alter table admin_users           enable row level security;
alter table brands                enable row level security;
alter table categories            enable row level security;
alter table products              enable row level security;
alter table product_categories    enable row level security;
alter table product_images        enable row level security;
alter table variants              enable row level security;
alter table inventory             enable row level security;
alter table carts                 enable row level security;
alter table cart_items            enable row level security;
alter table orders                enable row level security;
alter table order_items           enable row level security;
alter table payments              enable row level security;
alter table shipments             enable row level security;
alter table returns               enable row level security;
alter table return_items          enable row level security;
alter table restock_subscriptions enable row level security;
alter table wishlists             enable row level security;
alter table wishlist_items        enable row level security;
alter table reviews               enable row level security;
alter table discount_codes        enable row level security;

-- ---------- catalog: public read (active), admin write ----------
create policy cat_read_brands     on brands     for select using (true);
create policy cat_read_categories on categories for select using (true);
create policy cat_read_products   on products   for select using (status = 'active' or is_admin());
create policy cat_read_pcats      on product_categories for select using (true);
create policy cat_read_images     on product_images     for select using (true);
create policy cat_read_variants   on variants   for select using (status = 'active' or is_admin());
-- inventory: not public. expose availability via a view/RPC instead.
create policy cat_read_inventory  on inventory  for select using (is_admin());

create policy adm_write_brands    on brands     for all using (is_admin()) with check (is_admin());
create policy adm_write_cats      on categories for all using (is_admin()) with check (is_admin());
create policy adm_write_products  on products   for all using (is_admin()) with check (is_admin());
create policy adm_write_pcats     on product_categories for all using (is_admin()) with check (is_admin());
create policy adm_write_images    on product_images     for all using (is_admin()) with check (is_admin());
create policy adm_write_variants  on variants   for all using (is_admin()) with check (is_admin());
create policy adm_write_inventory on inventory  for all using (is_admin()) with check (is_admin());

-- ---------- customers / addresses: owner only ----------
create policy own_customer  on customers for select using (id = auth.uid() or is_admin());
create policy own_customer_u on customers for update using (id = auth.uid()) with check (id = auth.uid());
create policy own_addresses on addresses for all
  using (customer_id = auth.uid() or is_admin())
  with check (customer_id = auth.uid());

-- ---------- admin_users: admin manages, self can read ----------
create policy adm_read_admins  on admin_users for select using (user_id = auth.uid() or is_admin());
create policy adm_write_admins on admin_users for all using (is_admin()) with check (is_admin());

-- ---------- carts: owner (logged-in). guest carts handled server-side ----------
create policy own_cart on carts for all
  using (customer_id = auth.uid() or is_admin())
  with check (customer_id = auth.uid());
create policy own_cart_items on cart_items for all
  using (exists (select 1 from carts c where c.id = cart_items.cart_id and c.customer_id = auth.uid()) or is_admin())
  with check (exists (select 1 from carts c where c.id = cart_items.cart_id and c.customer_id = auth.uid()));

-- ---------- orders: owner read only; writes via service role / RPC ----------
create policy own_orders     on orders     for select using (customer_id = auth.uid() or is_admin());
create policy own_orderitems on order_items for select
  using (exists (select 1 from orders o where o.id = order_items.order_id and (o.customer_id = auth.uid() or is_admin())));
create policy own_payments   on payments   for select using (is_admin());
create policy own_shipments  on shipments  for select
  using (exists (select 1 from orders o where o.id = shipments.order_id and (o.customer_id = auth.uid() or is_admin())));
create policy adm_write_orders   on orders     for update using (is_admin()) with check (is_admin());
create policy adm_write_shipments on shipments for all using (is_admin()) with check (is_admin());

-- ---------- returns: owner create/read, admin manages ----------
create policy own_returns_read on returns for select using (customer_id = auth.uid() or is_admin());
create policy own_returns_ins  on returns for insert with check (customer_id = auth.uid());
create policy adm_returns_upd  on returns for update using (is_admin()) with check (is_admin());
create policy own_return_items on return_items for all
  using (exists (select 1 from returns r where r.id = return_items.return_id and (r.customer_id = auth.uid() or is_admin())))
  with check (exists (select 1 from returns r where r.id = return_items.return_id and r.customer_id = auth.uid()));

-- ---------- growth ----------
create policy restock_ins   on restock_subscriptions for insert with check (true);  -- guests can subscribe
create policy restock_adm   on restock_subscriptions for select using (is_admin());
create policy own_wishlist  on wishlists for all
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy own_wl_items  on wishlist_items for all
  using (exists (select 1 from wishlists w where w.id = wishlist_items.wishlist_id and w.customer_id = auth.uid()))
  with check (exists (select 1 from wishlists w where w.id = wishlist_items.wishlist_id and w.customer_id = auth.uid()));
create policy reviews_read  on reviews for select using (true);
create policy reviews_ins   on reviews for insert with check (customer_id = auth.uid());
create policy reviews_adm   on reviews for all using (is_admin()) with check (is_admin());
create policy discounts_adm on discount_codes for all using (is_admin()) with check (is_admin());
-- discount validation for shoppers happens via RPC (security definer), not direct select.
