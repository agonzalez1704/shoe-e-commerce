-- Best sellers, for the storefront.
--
-- The admin already has masVendidos(), but it runs on the service-role client
-- and returns revenue per product. The storefront needs the same ranking with
-- neither of those: it must be readable by anon, and it must not publish how
-- much of anything we sell. So this returns product ids in order and nothing
-- else — the ranking is the product, the volumes stay private.
--
-- SECURITY DEFINER because orders and order_items are behind RLS and a shopper
-- has no business reading them. The function only ever emits product ids that
-- are already public in the catalogue.
--
-- order_items keeps a variant_id (nullable, so history survives a deleted
-- variant) rather than a product_id, hence the join through variants. Rows
-- whose variant is gone simply drop out of the ranking.
create or replace function public.top_sellers(p_limit int default 8, p_days int default 90)
returns table (product_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select v.product_id
    from order_items oi
    join orders   o on o.id = oi.order_id
    join variants v on v.id = oi.variant_id
    join products p on p.id = v.product_id
   where o.status in ('paid', 'fulfilled')
     and o.created_at >= now() - make_interval(days => p_days)
     and p.status = 'active'
   group by v.product_id
   order by sum(oi.quantity) desc, max(o.created_at) desc
   limit greatest(1, least(p_limit, 24));
$$;

revoke all on function public.top_sellers(int, int) from public;
grant execute on function public.top_sellers(int, int) to anon, authenticated, service_role;
