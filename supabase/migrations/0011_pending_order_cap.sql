-- ============================================================
-- Mitigate inventory-exhaustion: a public checkout lets an attacker spam
-- unpaid OXXO/SPEI orders that reserve stock for up to 3 days. Cap the number
-- of concurrent unpaid (pending, non-expired) orders per identity:
--   logged-in  -> per customer_id
--   guest      -> per cart session_token (stamped onto the order)
-- Combined with per-IP rate limiting at the edge, this bounds the damage.
-- ============================================================

alter table orders add column if not exists session_token text;

create index if not exists orders_pending_customer_idx
  on orders (customer_id) where status = 'pending';
create index if not exists orders_pending_session_idx
  on orders (session_token) where status = 'pending';

-- recreate create_order with the cap + session_token stamping (same signature)
drop function if exists public.create_order(uuid, text, payment_method, jsonb, jsonb, text, boolean);

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
  v_pending      int;
  c_max_pending  constant int := 3;
begin
  select * into v_cart from carts where id = p_cart_id for update;
  if not found then raise exception 'cart % not found', p_cart_id; end if;

  if auth.uid() is not null and v_cart.customer_id is distinct from auth.uid() then
    raise exception 'not your cart';
  end if;
  if not exists (select 1 from cart_items where cart_id = p_cart_id) then
    raise exception 'cart is empty';
  end if;

  -- abuse cap: too many concurrent unpaid orders for this identity?
  if v_cart.customer_id is not null then
    select count(*) into v_pending from orders o
      where o.customer_id = v_cart.customer_id and o.status = 'pending' and o.expires_at > now();
  else
    select count(*) into v_pending from orders o
      where o.session_token = v_cart.session_token and o.status = 'pending' and o.expires_at > now();
  end if;
  if v_pending >= c_max_pending then
    raise exception 'too many pending orders: completa o espera a que expiren los pedidos sin pagar';
  end if;

  v_expires := now() + case p_payment_method
    when 'card' then interval '30 minutes'
    when 'spei' then interval '2 days'
    when 'oxxo' then interval '3 days'
  end;

  v_order_number := 'BL-' || to_char(nextval('order_number_seq'), 'FM000000');

  insert into orders (id, order_number, customer_id, session_token, email, status, currency,
                      payment_method, needs_invoice, expires_at,
                      shipping_address, billing_address)
  values (gen_random_uuid(), v_order_number, v_cart.customer_id, v_cart.session_token, p_email,
          'pending', 'MXN', p_payment_method, p_needs_invoice, v_expires,
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
    select * into v_disc from discount_codes dc
    where dc.code = p_discount_code and dc.active
      and (dc.starts_at is null or dc.starts_at <= now())
      and (dc.expires_at is null or dc.expires_at > now())
      and (dc.max_uses is null or dc.used_count < max_uses)
      and v_subtotal >= dc.min_subtotal_cents
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

grant execute on function public.create_order(uuid, text, payment_method, jsonb, jsonb, text, boolean) to authenticated;
