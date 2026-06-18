-- ============================================================
-- Phase 0 — order lifecycle RPCs. Cart -> order -> payment -> fulfilment.
-- Reservation happens at checkout (create_order), NOT at add-to-cart,
-- so browsing carts don't lock stock. Whole thing is one transaction:
-- if any line is out of stock, every reservation rolls back.
--
-- Flow:
--   checkout start     -> create_order()   reserves stock, status 'pending'
--   payment success    -> commit_order()   on_hand -, status 'paid'
--   abandon / expired  -> cancel_order()   releases stock, status 'cancelled'
-- Tax + shipping are set by the app (Stripe Tax) after create_order, before pay.
-- ============================================================

create sequence if not exists order_number_seq start 1000;

-- record the applied discount explicitly so totals never depend on read-order
alter table orders add column if not exists discount_cents bigint not null default 0;

-- ---------- create order from a cart ----------
create function public.create_order(
  p_cart_id       uuid,
  p_email         text,
  p_shipping      jsonb default null,
  p_billing       jsonb default null,
  p_discount_code text default null
)
returns table (
  order_id       uuid,
  order_number   text,
  subtotal_cents bigint,
  discount_cents bigint,
  total_cents    bigint
)
language plpgsql security definer set search_path = public as $$
declare
  v_cart          carts%rowtype;
  v_order_id      uuid;
  v_order_number  text;
  v_subtotal      bigint := 0;
  v_discount      bigint := 0;
  v_disc          discount_codes%rowtype;
  v_item          record;
  v_unit_price    bigint;
  v_label         text;
begin
  -- lock cart, validate it exists
  select * into v_cart from carts where id = p_cart_id for update;
  if not found then
    raise exception 'cart % not found', p_cart_id;
  end if;

  -- ownership: logged-in user may only check out their own cart.
  -- guests (auth.uid() is null) reach here via the service role only.
  if auth.uid() is not null and v_cart.customer_id is distinct from auth.uid() then
    raise exception 'not your cart';
  end if;

  if not exists (select 1 from cart_items where cart_id = p_cart_id) then
    raise exception 'cart is empty';
  end if;

  v_order_number := 'BL-' || to_char(nextval('order_number_seq'), 'FM000000');

  insert into orders (id, order_number, customer_id, email, status,
                      shipping_address, billing_address)
  values (gen_random_uuid(), v_order_number, v_cart.customer_id, p_email, 'pending',
          p_shipping, p_billing)
  returning id into v_order_id;

  -- walk each line: reserve stock, snapshot price + labels
  for v_item in
    select ci.variant_id, ci.quantity,
           v.size_system, v.size_value, v.width, v.color, v.sku,
           coalesce(v.price_cents, p.base_price_cents) as price_cents,
           p.name as product_name
    from cart_items ci
    join variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    where ci.cart_id = p_cart_id
  loop
    -- oversell guard: FOR UPDATE lock inside reserve_stock
    if not reserve_stock(v_item.variant_id, v_item.quantity) then
      raise exception 'out of stock: % (% available)',
        v_item.sku, (select qty_on_hand - qty_reserved from inventory where variant_id = v_item.variant_id);
    end if;

    v_unit_price := v_item.price_cents;
    v_label := v_item.size_system || ' ' || v_item.size_value
               || ' / ' || v_item.width || ' / ' || v_item.color;

    insert into order_items (order_id, variant_id, product_name, variant_label,
                             sku, unit_price_cents, quantity, line_total_cents)
    values (v_order_id, v_item.variant_id, v_item.product_name, v_label,
            v_item.sku, v_unit_price, v_item.quantity, v_unit_price * v_item.quantity);

    v_subtotal := v_subtotal + v_unit_price * v_item.quantity;
  end loop;

  -- optional discount
  if p_discount_code is not null then
    select * into v_disc from discount_codes
    where code = p_discount_code and active = true
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
      and (max_uses is null or used_count < max_uses)
      and v_subtotal >= min_subtotal_cents
    for update;

    if found then
      if v_disc.type = 'percent' then
        v_discount := (v_subtotal * v_disc.value) / 100;
      else
        v_discount := least(v_disc.value, v_subtotal);
      end if;
      update discount_codes set used_count = used_count + 1 where id = v_disc.id;
    else
      raise exception 'invalid or expired discount code';
    end if;
  end if;

  -- tax + shipping added later by the app; total here = subtotal - discount
  update orders
  set subtotal_cents = v_subtotal,
      discount_cents = v_discount,
      total_cents    = v_subtotal - v_discount
  where id = v_order_id;

  -- consume the cart so it can't be checked out twice
  delete from cart_items where cart_id = p_cart_id;

  return query select v_order_id, v_order_number, v_subtotal, v_discount, (v_subtotal - v_discount);
end;
$$;

-- ---------- finalize totals once Stripe Tax + shipping are known ----------
create function public.set_order_amounts(
  p_order_id uuid, p_tax_cents bigint, p_shipping_cents bigint
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update orders
  set tax_cents      = p_tax_cents,
      shipping_cents = p_shipping_cents,
      total_cents    = subtotal_cents - discount_cents + p_tax_cents + p_shipping_cents
  where id = p_order_id and status = 'pending';
end;
$$;

-- ---------- commit order on payment success (Stripe webhook) ----------
create function public.commit_order(p_order_id uuid, p_payment_intent text, p_amount_cents bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_item record;
begin
  -- idempotent: webhooks retry. skip if already paid.
  if exists (select 1 from orders where id = p_order_id and status <> 'pending') then
    return;
  end if;

  for v_item in select variant_id, quantity from order_items
                where order_id = p_order_id and variant_id is not null
  loop
    perform commit_stock(v_item.variant_id, v_item.quantity);
  end loop;

  update orders set status = 'paid' where id = p_order_id;

  insert into payments (order_id, stripe_payment_intent_id, amount_cents, status, method)
  values (p_order_id, p_payment_intent, p_amount_cents, 'succeeded', 'card')
  on conflict (stripe_payment_intent_id) do nothing;
end;
$$;

-- ---------- cancel a pending order, release its reservations ----------
create function public.cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_item record;
begin
  if not exists (select 1 from orders where id = p_order_id and status = 'pending') then
    return;
  end if;

  for v_item in select variant_id, quantity from order_items
                where order_id = p_order_id and variant_id is not null
  loop
    perform release_stock(v_item.variant_id, v_item.quantity);
  end loop;

  update orders set status = 'cancelled' where id = p_order_id;
end;
$$;

-- ---------- grants ----------
-- create_order: authenticated users (own cart) + service role (guests).
grant execute on function public.create_order(uuid, text, jsonb, jsonb, text) to authenticated;
-- the rest are server-only (service role): payment webhook + cleanup job.
revoke all on function public.set_order_amounts(uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function public.commit_order(uuid, text, bigint)        from public, anon, authenticated;
revoke all on function public.cancel_order(uuid)                      from public, anon, authenticated;
