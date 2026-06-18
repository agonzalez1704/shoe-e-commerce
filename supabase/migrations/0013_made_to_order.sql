-- ============================================================
-- Made-to-order model. The store starts with NO real stock — shoes are made on
-- demand. Such products: no availability shown, always purchasable, no oversell
-- guard. Per-product flag so items can later be switched to real stock tracking.
--
-- Implementation keeps the order RPCs untouched by making the three stock
-- primitives (reserve/commit/release) no-op for made-to-order variants.
-- ============================================================

alter table products add column if not exists made_to_order boolean not null default true;

-- availability view: made-to-order is always in stock (no inventory row needed)
create or replace view public.variant_availability as
  select
    v.id         as variant_id,
    v.product_id,
    case when p.made_to_order then 9999
         else greatest(coalesce(i.qty_on_hand, 0) - coalesce(i.qty_reserved, 0), 0) end as qty_available,
    case when p.made_to_order then true
         else (coalesce(i.qty_on_hand, 0) - coalesce(i.qty_reserved, 0)) > 0 end as in_stock,
    p.made_to_order
  from variants v
  join products p on p.id = v.product_id
  left join inventory i on i.variant_id = v.id
  where v.status = 'active';

-- reserve: unlimited for made-to-order
create or replace function public.reserve_stock(p_variant_id uuid, p_qty int)
returns boolean language plpgsql security definer set search_path = public as $$
declare available int; v_mto boolean;
begin
  if p_qty <= 0 then raise exception 'quantity must be positive'; end if;

  select p.made_to_order into v_mto
  from variants v join products p on p.id = v.product_id where v.id = p_variant_id;
  if v_mto then return true; end if;  -- made to order: no reservation

  select qty_on_hand - qty_reserved into available
  from inventory where variant_id = p_variant_id for update;
  if available is null then raise exception 'no inventory row for variant %', p_variant_id; end if;
  if available < p_qty then return false; end if;

  update inventory set qty_reserved = qty_reserved + p_qty where variant_id = p_variant_id;
  return true;
end;
$$;

-- commit: no-op for made-to-order
create or replace function public.commit_stock(p_variant_id uuid, p_qty int)
returns void language plpgsql security definer set search_path = public as $$
declare v_mto boolean;
begin
  select p.made_to_order into v_mto
  from variants v join products p on p.id = v.product_id where v.id = p_variant_id;
  if v_mto then return; end if;
  update inventory
  set qty_on_hand  = qty_on_hand - p_qty,
      qty_reserved = greatest(qty_reserved - p_qty, 0)
  where variant_id = p_variant_id;
end;
$$;

-- release: no-op for made-to-order
create or replace function public.release_stock(p_variant_id uuid, p_qty int)
returns void language plpgsql security definer set search_path = public as $$
declare v_mto boolean;
begin
  select p.made_to_order into v_mto
  from variants v join products p on p.id = v.product_id where v.id = p_variant_id;
  if v_mto then return; end if;
  update inventory set qty_reserved = greatest(qty_reserved - p_qty, 0)
  where variant_id = p_variant_id;
end;
$$;
