-- ============================================================
-- Phase 2 — order RPCs reworked for Conekta + MX (replaces 0004 versions).
-- IVA 16% is INCLUSIVE: tax_cents is the IVA portion of the total, not added on.
-- Reservation TTL depends on method (card 30m, spei 2d, oxxo 3d).
-- ============================================================

-- drop old signatures from 0004
drop function if exists public.create_order(uuid, text, jsonb, jsonb, text);
drop function if exists public.set_order_amounts(uuid, bigint, bigint);
drop function if exists public.commit_order(uuid, text, bigint);

-- IVA portion of an inclusive amount (16%): amount * 16 / 116
create function public.iva_of(p_inclusive bigint)
returns bigint language sql immutable as $$
  select (round(p_inclusive::numeric * 16 / 116))::bigint;
$$;

-- ---------- create order from cart ----------
create function public.create_order(
  p_cart_id        uuid,
  p_email          text,
  p_payment_method payment_method,
  p_shipping       jsonb default null,
  p_billing        jsonb default null,
  p_discount_code  text default null,
  p_needs_invoice  boolean default false
)
returns table (
  order_id       uuid,
  order_number   text,
  subtotal_cents bigint,
  discount_cents bigint,
  tax_cents      bigint,
  total_cents    bigint,
  expires_at     timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_cart         carts%rowtype;
  v_order_id     uuid;
  v_order_number text;
  v_subtotal     bigint := 0;
  v_discount     bigint := 0;
  v_disc         discount_codes%rowtype;
  v_item         record;
  v_label        text;
  v_expires      timestamptz;
  v_base         bigint;
  v_tax          bigint;
begin
  select * into v_cart from carts where id = p_cart_id for update;
  if not found then raise exception 'cart % not found', p_cart_id; end if;

  if auth.uid() is not null and v_cart.customer_id is distinct from auth.uid() then
    raise exception 'not your cart';
  end if;
  if not exists (select 1 from cart_items where cart_id = p_cart_id) then
    raise exception 'cart is empty';
  end if;

  -- reservation / voucher deadline by method
  v_expires := now() + case p_payment_method
    when 'card' then interval '30 minutes'
    when 'spei' then interval '2 days'
    when 'oxxo' then interval '3 days'
  end;

  v_order_number := 'BL-' || to_char(nextval('order_number_seq'), 'FM000000');

  insert into orders (id, order_number, customer_id, email, status, currency,
                      payment_method, needs_invoice, expires_at,
                      shipping_address, billing_address)
  values (gen_random_uuid(), v_order_number, v_cart.customer_id, p_email, 'pending', 'MXN',
          p_payment_method, p_needs_invoice, v_expires,
          p_shipping, p_billing)
  returning id into v_order_id;

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
    if not reserve_stock(v_item.variant_id, v_item.quantity) then
      raise exception 'out of stock: %', v_item.sku;
    end if;

    v_label := v_item.size_system || ' ' || v_item.size_value
               || ' / ' || v_item.width || ' / ' || v_item.color;

    insert into order_items (order_id, variant_id, product_name, variant_label,
                             sku, unit_price_cents, quantity, line_total_cents)
    values (v_order_id, v_item.variant_id, v_item.product_name, v_label,
            v_item.sku, v_item.price_cents, v_item.quantity,
            v_item.price_cents * v_item.quantity);

    v_subtotal := v_subtotal + v_item.price_cents * v_item.quantity;
  end loop;

  if p_discount_code is not null then
    select * into v_disc from discount_codes
    where code = p_discount_code and active
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
      and (max_uses is null or used_count < max_uses)
      and v_subtotal >= min_subtotal_cents
    for update;
    if found then
      v_discount := case when v_disc.type = 'percent'
                         then (v_subtotal * v_disc.value) / 100
                         else least(v_disc.value, v_subtotal) end;
      update discount_codes set used_count = used_count + 1 where id = v_disc.id;
    else
      raise exception 'invalid or expired discount code';
    end if;
  end if;

  -- IVA-inclusive: total = subtotal - discount (shipping added later); tax = IVA portion
  v_base := v_subtotal - v_discount;
  v_tax  := iva_of(v_base);

  update orders
  set subtotal_cents = v_subtotal,
      discount_cents = v_discount,
      tax_cents      = v_tax,
      total_cents    = v_base
  where id = v_order_id;

  delete from cart_items where cart_id = p_cart_id;

  return query select v_order_id, v_order_number, v_subtotal, v_discount, v_tax, v_base, v_expires;
end;
$$;

-- ---------- add shipping once known; recompute IVA on the new total ----------
create function public.set_order_amounts(p_order_id uuid, p_shipping_cents bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_base bigint;
begin
  select subtotal_cents - discount_cents + p_shipping_cents into v_base
  from orders where id = p_order_id and status = 'pending';
  if v_base is null then return; end if;

  update orders
  set shipping_cents = p_shipping_cents,
      tax_cents      = iva_of(v_base),
      total_cents    = v_base
  where id = p_order_id;
end;
$$;

-- ---------- record the pending payment (voucher/CLABE) from Conekta ----------
create function public.record_payment(
  p_order_id          uuid,
  p_provider_charge_id text,
  p_method            payment_method,
  p_amount_cents      bigint,
  p_reference         text default null,
  p_clabe             text default null,
  p_voucher_url       text default null,
  p_expires_at        timestamptz default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into payments (order_id, provider, provider_charge_id, method, amount_cents,
                        status, reference, clabe, voucher_url, expires_at)
  values (p_order_id, 'conekta', p_provider_charge_id, p_method, p_amount_cents,
          'pending', p_reference, p_clabe, p_voucher_url, p_expires_at)
  on conflict (provider_charge_id) do update
    set reference = excluded.reference,
        clabe = excluded.clabe,
        voucher_url = excluded.voucher_url,
        expires_at = excluded.expires_at;
end;
$$;

-- ---------- commit on payment success (Conekta webhook: order.paid) ----------
create function public.commit_order(
  p_order_id uuid, p_charge_id text, p_amount_cents bigint, p_method payment_method
)
returns void language plpgsql security definer set search_path = public as $$
declare v_item record;
begin
  if exists (select 1 from orders where id = p_order_id and status <> 'pending') then
    return;  -- idempotent: webhooks retry
  end if;

  for v_item in select variant_id, quantity from order_items
                where order_id = p_order_id and variant_id is not null
  loop
    perform commit_stock(v_item.variant_id, v_item.quantity);
  end loop;

  update orders set status = 'paid' where id = p_order_id;

  insert into payments (order_id, provider, provider_charge_id, method, amount_cents, status)
  values (p_order_id, 'conekta', p_charge_id, p_method, p_amount_cents, 'succeeded')
  on conflict (provider_charge_id) do update set status = 'succeeded';
end;
$$;

-- ---------- expire stale pending orders (cron / scheduled Edge Function) ----------
create function public.expire_pending_orders()
returns int language plpgsql security definer set search_path = public as $$
declare v_order record; v_item record; v_count int := 0;
begin
  for v_order in
    select id from orders where status = 'pending' and expires_at < now()
  loop
    for v_item in select variant_id, quantity from order_items
                  where order_id = v_order.id and variant_id is not null
    loop
      perform release_stock(v_item.variant_id, v_item.quantity);
    end loop;
    update orders set status = 'cancelled' where id = v_order.id;
    update payments set status = 'expired'
      where order_id = v_order.id and status = 'pending';
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------- grants ----------
grant execute on function public.create_order(uuid, text, payment_method, jsonb, jsonb, text, boolean) to authenticated;
revoke all on function public.set_order_amounts(uuid, bigint)              from public, anon, authenticated;
revoke all on function public.record_payment(uuid, text, payment_method, bigint, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.commit_order(uuid, text, bigint, payment_method) from public, anon, authenticated;
revoke all on function public.expire_pending_orders()                      from public, anon, authenticated;
