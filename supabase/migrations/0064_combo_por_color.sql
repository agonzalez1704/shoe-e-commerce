-- Combo por color. El combo vivia en products.combo_group, asi que un modelo
-- entraba completo o no entraba: New Jersey tiene colores dentro y colores
-- fuera. Marca por variante (se opera por color desde el armador): por defecto
-- todo sigue dentro y nada cambia hasta que se apague un color.
alter table variants add column if not exists fuera_de_combo boolean not null default false;

-- create_order: identico a 0056 salvo que una variante fuera de combo no entra
-- al pool (ni a la marca de combo de su linea).
create or replace function public.create_order(
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
  v_prefix       text;
  v_subtotal     bigint := 0;
  v_discount     bigint := 0;
  v_combo        bigint := 0;
  v_disc         discount_codes%rowtype;
  v_item         record;
  v_label        text;
  v_expires      timestamptz;
  v_base         bigint;
  v_tax          bigint;
  v_unit         bigint;
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

  if v_cart.customer_id is not null then
    select count(*) into v_pending from orders o
      where o.customer_id = v_cart.customer_id and o.status = 'pending'
        and (o.expires_at is null or o.expires_at > now());
  else
    select count(*) into v_pending from orders o
      where o.session_token = v_cart.session_token and o.status = 'pending'
        and (o.expires_at is null or o.expires_at > now());
  end if;
  if v_pending >= c_max_pending then
    raise exception 'too many pending orders: completa o espera a que expiren los pedidos sin pagar';
  end if;

  v_expires := now() + case p_payment_method
    when 'card' then interval '30 minutes'
    when 'spei' then interval '2 days'
    when 'oxxo' then interval '3 days'
  end;

  -- El prefijo sale de settings. Iba fijo en 'BL-', así que los pedidos de
  -- cualquier segunda tienda salían con las iniciales de la primera. Sin fila,
  -- sigue siendo 'BL-': Blade no cambia y no hace falta configurar nada.
  select coalesce(nullif(value, ''), 'BL-') into v_prefix from settings where key = 'order_prefix';
  v_order_number := coalesce(v_prefix, 'BL-') || to_char(nextval('order_number_seq'), 'FM000000');

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
           p.name as product_name,
           case when v.fuera_de_combo then null else p.combo_group end as combo_group,
           promo.percent as promo_percent
    from cart_items ci
    join variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    left join lateral (
      select max(pr.percent)::int as percent
      from promocion_productos pp
      join promociones pr on pr.id = pp.promocion_id
      where pp.product_id = p.id
        and pr.active
        and pr.starts_at <= now()
        and pr.ends_at > now()
    ) promo on true
    where ci.cart_id = p_cart_id
  loop
    if not reserve_stock(v_item.variant_id, v_item.quantity) then
      raise exception 'out of stock: %', v_item.sku;
    end if;

    -- Promo applies to every product now. If these units pair into a combo the
    -- combo discount below reprices them (better deal wins, no stacking).
    if v_item.promo_percent is not null then
      v_unit := round(v_item.price_cents * (100 - v_item.promo_percent) / 100.0)::bigint;
    else
      v_unit := v_item.price_cents;
    end if;

    -- concat_ws salta los NULL; `||` los propaga. Un scooter no tiene talla ni
    -- ancho, así que la etiqueta entera salía NULL y el insert reventaba contra
    -- el not null de order_items. Para un zapato el resultado es idéntico:
    -- 'MX 27 / medium / black'.
    v_label := coalesce(
      nullif(concat_ws(' / ',
        -- ::text porque size_system y width son enums: sin el cast, el
        -- coalesce intenta convertir '' al enum y revienta.
        nullif(trim(coalesce(v_item.size_system::text, '') || ' ' || coalesce(v_item.size_value, '')), ''),
        nullif(v_item.width::text, ''),
        nullif(v_item.color, '')
      ), ''),
      '—');

    insert into order_items (order_id, variant_id, product_name, variant_label,
                             sku, unit_price_cents, quantity, line_total_cents)
    values (v_order_id, v_item.variant_id, v_item.product_name, v_label,
            v_item.sku, v_unit, v_item.quantity, v_unit * v_item.quantity);

    v_subtotal := v_subtotal + v_unit * v_item.quantity;
  end loop;

  -- combo POOL discount: products sharing combo_group pool together; every
  -- combo_min_qty units cost combo_price_cents. Pairs are formed from the
  -- most-expensive units. Unit prices here are already promo-discounted, so the
  -- pool discount only kicks in when the combo beats 2×(promo price).
  select coalesce(sum(greatest(0, g.paired - g.pairs * g.cprice)), 0)
    into v_combo
  from (
    select r.grp,
           (max(r.n) / max(r.minq)) as pairs,
           max(r.cprice) as cprice,
           coalesce(sum(r.price) filter (where r.rn <= (r.n / r.minq) * r.minq), 0) as paired
    from (
      select p.combo_group as grp, p.combo_min_qty as minq, p.combo_price_cents as cprice,
             round(coalesce(v.price_cents, p.base_price_cents) * (100 - coalesce(cp.percent, 0)) / 100.0)::bigint as price,
             row_number() over (partition by p.combo_group
               order by round(coalesce(v.price_cents, p.base_price_cents) * (100 - coalesce(cp.percent, 0)) / 100.0) desc) as rn,
             count(*) over (partition by p.combo_group) as n
      from cart_items ci
      join variants v on v.id = ci.variant_id
      join products p on p.id = v.product_id
      left join lateral (
        select max(pr.percent)::int as percent
        from promocion_productos pp
        join promociones pr on pr.id = pp.promocion_id
        where pp.product_id = p.id
          and pr.active and pr.starts_at <= now() and pr.ends_at > now()
      ) cp on true
      cross join generate_series(1, ci.quantity)
      where ci.cart_id = p_cart_id
        and not v.fuera_de_combo
        and p.combo_group is not null
        and p.combo_min_qty is not null
        and p.combo_price_cents is not null
    ) r
    group by r.grp
  ) g;

  v_discount := v_combo;

  if p_discount_code is not null then
    select * into v_disc from discount_codes dc
    where dc.code = p_discount_code and dc.active
      and (dc.starts_at is null or dc.starts_at <= now())
      and (dc.expires_at is null or dc.expires_at > now())
      and (dc.max_uses is null or dc.used_count < dc.max_uses)
      and v_subtotal >= dc.min_subtotal_cents
    for update;
    if found then
      -- Gana el mejor para el comprador, no la suma. El combo 2x$1,999 ya es un
      -- descuento fuerte; encimarle el 10% de bienvenida regalaba margen dos
      -- veces sobre el mismo pedido.
      v_discount := greatest(v_combo, case when v_disc.type = 'percent'
                         then (v_subtotal * v_disc.value) / 100
                         else least(v_disc.value, v_subtotal) end);
      update discount_codes set used_count = used_count + 1 where id = v_disc.id;
    else
      raise exception 'invalid or expired discount code';
    end if;
  end if;

  v_discount := least(v_discount, v_subtotal);  -- never negative
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

-- crear_pedido_complemento: identico a 0060 salvo que el par elegido debe estar
-- dentro del combo y las unidades ya compradas fuera de combo no cuentan.
create or replace function crear_pedido_complemento(
  p_parent_order_id uuid,
  p_variant_id uuid
) returns table (out_order_id uuid, out_order_number text)
language plpgsql security definer set search_path = public as $$
declare
  v_parent orders%rowtype;
  v_child record;
  v_variant record;
  v_units int;
  v_pairs int;
  v_rem int;
  v_paid_group bigint;
  v_diff bigint;
  v_prefix text;
  v_number text;
  v_id uuid;
  v_label text;
begin
  select * into v_parent from orders where id = p_parent_order_id;
  if v_parent.id is null then raise exception 'Pedido no encontrado'; end if;
  if v_parent.status not in ('paid', 'fulfilled') then
    raise exception 'El pedido original debe estar pagado';
  end if;

  -- ya hay complemento vivo: devolverlo (doble clic, correo reabierto)
  select id, order_number into v_child from orders
   where combo_parent_order_id = p_parent_order_id
     and status not in ('cancelled', 'refunded')
   limit 1;
  if v_child.id is not null then
    return query select v_child.id, v_child.order_number; return;
  end if;

  -- la variante elegida, con su producto y config de combo
  select v.id, v.sku, v.size_system, v.size_value, v.width, v.color,
         p.id as product_id, p.name as product_name,
         p.combo_group, p.combo_min_qty, p.combo_price_cents
    into v_variant
    from variants v join products p on p.id = v.product_id
   where v.id = p_variant_id and v.status = 'active' and not v.fuera_de_combo;
  if v_variant.id is null or v_variant.combo_group is null then
    raise exception 'Ese par no participa en el combo';
  end if;

  -- unidades del pool ya comparadas en el pedido original y lo pagado por las sueltas
  select coalesce(sum(oi.quantity), 0), coalesce(sum(oi.line_total_cents), 0)
    into v_units, v_paid_group
    from order_items oi
    join variants vv on vv.id = oi.variant_id
    join products pp on pp.id = vv.product_id
   where oi.order_id = p_parent_order_id and pp.combo_group = v_variant.combo_group and not vv.fuera_de_combo;

  v_pairs := v_units / v_variant.combo_min_qty;
  v_rem := v_units % v_variant.combo_min_qty;
  if v_rem <> v_variant.combo_min_qty - 1 then
    raise exception 'Este pedido no tiene un par suelto elegible para completar el combo';
  end if;
  -- lo pagado por los sueltos = total del grupo menos los combos ya completos
  v_paid_group := v_paid_group - v_pairs * v_variant.combo_price_cents;
  v_diff := v_variant.combo_price_cents - v_paid_group;
  if v_diff <= 0 then
    raise exception 'La diferencia del combo no es positiva; revisar con soporte';
  end if;

  select coalesce(nullif(value, ''), 'BL-') into v_prefix from settings where key = 'order_prefix';
  v_number := coalesce(v_prefix, 'BL-') || to_char(nextval('order_number_seq'), 'FM000000');

  insert into orders (id, order_number, customer_id, email, status, currency, payment_method,
                      needs_invoice, expires_at, shipping_address, billing_address,
                      subtotal_cents, tax_cents, shipping_cents, discount_cents, total_cents,
                      combo_parent_order_id)
  values (gen_random_uuid(), v_number, v_parent.customer_id, v_parent.email, 'pending', 'MXN',
          'mercadopago', false, now() + interval '3 days',
          v_parent.shipping_address, v_parent.billing_address,
          v_diff, round(v_diff - v_diff / 1.16), 0, 0, v_diff,
          p_parent_order_id)
  returning id into v_id;

  v_label := v_variant.size_system || ' ' || v_variant.size_value || ' / ' ||
             v_variant.width || ' / ' || v_variant.color;
  insert into order_items (order_id, variant_id, product_name, variant_label, sku,
                           unit_price_cents, quantity, line_total_cents)
  values (v_id, v_variant.id,
          v_variant.product_name || ' (completa tu combo)',
          v_label, v_variant.sku, v_diff, 1, v_diff);

  return query select v_id, v_number;
end $$;

revoke all on function crear_pedido_complemento(uuid, uuid) from public, anon, authenticated;

