-- ============================================================
-- Phase 0 — oversell-safe inventory ops + public availability view.
-- All stock math happens in the DB, never in app code. Row locks
-- serialize concurrent carts so two buyers can't claim the last pair.
-- ============================================================

-- public availability (no raw on_hand/reserved leakage)
create view public.variant_availability as
  select
    v.id            as variant_id,
    v.product_id,
    greatest(i.qty_on_hand - i.qty_reserved, 0) as qty_available,
    (i.qty_on_hand - i.qty_reserved) > 0        as in_stock
  from variants v
  join inventory i on i.variant_id = v.id
  where v.status = 'active';

grant select on public.variant_availability to anon, authenticated;

-- reserve stock (call when adding to cart / starting checkout)
create function public.reserve_stock(p_variant_id uuid, p_qty int)
returns boolean language plpgsql security definer set search_path = public as $$
declare available int;
begin
  if p_qty <= 0 then
    raise exception 'quantity must be positive';
  end if;

  -- lock the inventory row; concurrent callers queue here
  select qty_on_hand - qty_reserved into available
  from inventory where variant_id = p_variant_id for update;

  if available is null then
    raise exception 'no inventory row for variant %', p_variant_id;
  end if;
  if available < p_qty then
    return false;  -- caller surfaces "out of stock"
  end if;

  update inventory set qty_reserved = qty_reserved + p_qty
  where variant_id = p_variant_id;
  return true;
end;
$$;

-- release a reservation (cart abandon / item removed / checkout expired)
create function public.release_stock(p_variant_id uuid, p_qty int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update inventory
  set qty_reserved = greatest(qty_reserved - p_qty, 0)
  where variant_id = p_variant_id;
end;
$$;

-- commit a reservation to a real sale (call from Stripe webhook on payment success)
create function public.commit_stock(p_variant_id uuid, p_qty int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update inventory
  set qty_on_hand  = qty_on_hand - p_qty,
      qty_reserved = greatest(qty_reserved - p_qty, 0)
  where variant_id = p_variant_id;
end;
$$;

-- restock (admin / receiving)
create function public.restock(p_variant_id uuid, p_qty int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  update inventory set qty_on_hand = qty_on_hand + p_qty
  where variant_id = p_variant_id;
end;
$$;

-- lock down execute: reserve/release/commit are server-side only (service role).
revoke all on function public.reserve_stock(uuid, int) from public, anon, authenticated;
revoke all on function public.release_stock(uuid, int) from public, anon, authenticated;
revoke all on function public.commit_stock(uuid, int)  from public, anon, authenticated;
-- restock self-guards via is_admin(); allow authenticated to attempt.
grant execute on function public.restock(uuid, int) to authenticated;
