-- Combos por tarifa (0066). El precio de un par depende de la piel de los dos:
--   0 exoticos -> combo_price_cents         (clasico, 2 x $1,999)
--   1 exotico  -> combo_price_mixto_cents   (mixto,   $2,200)
--   2 exoticos -> combo_price_exotico_cents (exotico, $2,400)
-- variants.exotico marca la piel por color (Roma negro/rojo es exotico, el resto
-- de Roma no). Los precios mixto/exotico en null caen al base: un combo viejo
-- sigue cobrando igual. Se espeja en lib/pricing.ts.

alter table variants add column if not exists exotico boolean not null default false;
alter table products
  add column if not exists combo_price_mixto_cents integer,
  add column if not exists combo_price_exotico_cents integer;

create or replace function combo_precio_par(p_base int, p_mixto int, p_exotico int, p_n_exoticos int)
returns int language sql immutable as $$
  select case p_n_exoticos
    when 0 then p_base
    when 1 then coalesce(p_mixto, p_base)
    else coalesce(p_exotico, p_base)
  end;
$$;

-- Descuento de un pool: recibe las unidades (precio ya con promo, exotico) de un
-- grupo. Con min_qty = 2 arma pares: exotico con exotico primero, clasico con
-- clasico despues, y si sobran uno de cada, un mixto; cada par cuesta su tarifa.
-- ponytail: greedy por piel y precio desc; no busca el optimo global.
-- Con min_qty <> 2 usa el modelo plano de antes (cada min_qty unidades = base).
create or replace function combo_descuento_pool(
  p_precios bigint[], p_exoticos boolean[], p_min int, p_base int, p_mixto int, p_exotico int
) returns bigint language plpgsql immutable as $$
declare
  ex bigint[] := '{}'; cl bigint[] := '{}'; todos bigint[];
  n int; pares int; suma bigint := 0; descuento bigint := 0;
begin
  if p_precios is null or p_base is null then return 0; end if;
  n := coalesce(array_length(p_precios, 1), 0);

  if p_min <> 2 then
    select array_agg(x order by x desc) into todos from unnest(p_precios) x;
    pares := n / p_min;
    if pares = 0 then return 0; end if;
    select sum(x) into suma from unnest(todos[1:pares * p_min]) x;
    return greatest(0, suma - pares * p_base);
  end if;

  select coalesce(array_agg(x order by x desc), '{}') into ex
    from unnest(p_precios, p_exoticos) as u(x, e) where e;
  select coalesce(array_agg(x order by x desc), '{}') into cl
    from unnest(p_precios, p_exoticos) as u(x, e) where not e;

  while coalesce(array_length(ex, 1), 0) >= 2 loop
    descuento := descuento + greatest(0, ex[1] + ex[2] - combo_precio_par(p_base, p_mixto, p_exotico, 2));
    ex := ex[3:];
  end loop;
  while coalesce(array_length(cl, 1), 0) >= 2 loop
    descuento := descuento + greatest(0, cl[1] + cl[2] - combo_precio_par(p_base, p_mixto, p_exotico, 0));
    cl := cl[3:];
  end loop;
  if coalesce(array_length(ex, 1), 0) = 1 and coalesce(array_length(cl, 1), 0) = 1 then
    descuento := descuento + greatest(0, ex[1] + cl[1] - combo_precio_par(p_base, p_mixto, p_exotico, 1));
  end if;
  return descuento;
end $$;

grant execute on function combo_precio_par(int, int, int, int) to anon, authenticated;
grant execute on function combo_descuento_pool(bigint[], boolean[], int, int, int, int) to anon, authenticated;

-- create_order: 0065 verbatim salvo el bloque del pool.
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
        and (pp.colores is null or v.color = any(pp.colores))
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

  -- combo POOL discount: products sharing combo_group pool together. El precio
  -- de cada par depende de la piel (0066): 0 exoticos = base, 1 = mixto,
  -- 2 = exotico. Unit prices here are already promo-discounted, so the pool
  -- discount only kicks in when the combo beats the promo prices.
  select coalesce(sum(combo_descuento_pool(u.precios, u.exoticos, u.minq, u.cbase, u.cmixto, u.cexot)), 0)
    into v_combo
  from (
    select p.combo_group as grp,
           max(p.combo_min_qty) as minq,
           max(p.combo_price_cents) as cbase,
           max(p.combo_price_mixto_cents) as cmixto,
           max(p.combo_price_exotico_cents) as cexot,
           array_agg(round(coalesce(v.price_cents, p.base_price_cents) * (100 - coalesce(cp.percent, 0)) / 100.0)::bigint) as precios,
           array_agg(v.exotico) as exoticos
    from cart_items ci
    join variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    left join lateral (
      select max(pr.percent)::int as percent
      from promocion_productos pp
      join promociones pr on pr.id = pp.promocion_id
      where pp.product_id = p.id
        and (pp.colores is null or v.color = any(pp.colores))
        and pr.active and pr.starts_at <= now() and pr.ends_at > now()
    ) cp on true
    cross join generate_series(1, ci.quantity)
    where ci.cart_id = p_cart_id
      and not v.fuera_de_combo
      and p.combo_group is not null
      and p.combo_min_qty is not null
      and p.combo_price_cents is not null
    group by p.combo_group
  ) u;

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

-- crear_pedido_complemento: 0064 con la diferencia calculada por tarifa.
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
  v_exoticos int;
  v_suelto_exotico boolean;
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
         p.combo_group, p.combo_min_qty, p.combo_price_cents,
         p.combo_price_mixto_cents, p.combo_price_exotico_cents, v.exotico
    into v_variant
    from variants v join products p on p.id = v.product_id
   where v.id = p_variant_id and v.status = 'active' and not v.fuera_de_combo;
  if v_variant.id is null or v_variant.combo_group is null then
    raise exception 'Ese par no participa en el combo';
  end if;

  -- unidades del pool en el pedido original y cuantas son exoticas
  select coalesce(sum(oi.quantity), 0), coalesce(sum(oi.quantity) filter (where vv.exotico), 0)
    into v_units, v_exoticos
    from order_items oi
    join variants vv on vv.id = oi.variant_id
    join products pp on pp.id = vv.product_id
   where oi.order_id = p_parent_order_id and pp.combo_group = v_variant.combo_group and not vv.fuera_de_combo;

  v_pairs := v_units / v_variant.combo_min_qty;
  v_rem := v_units % v_variant.combo_min_qty;
  if v_rem <> v_variant.combo_min_qty - 1 then
    raise exception 'Este pedido no tiene un par suelto elegible para completar el combo';
  end if;

  -- El par suelto es el que el pool deja sin pareja: los exoticos se emparejan
  -- entre si primero, asi que si quedan impares el suelto es el exotico mas
  -- barato; si no, el clasico mas barato (mismo criterio que combo_descuento_pool).
  v_suelto_exotico := (v_exoticos % 2 = 1);
  select oi.unit_price_cents into v_paid_group
    from order_items oi
    join variants vv on vv.id = oi.variant_id
    join products pp on pp.id = vv.product_id
   where oi.order_id = p_parent_order_id and pp.combo_group = v_variant.combo_group
     and not vv.fuera_de_combo and vv.exotico = v_suelto_exotico
   order by oi.unit_price_cents asc limit 1;

  -- lo que falta = precio del par segun la piel de los dos, menos lo ya pagado por el suelto
  v_diff := combo_precio_par(v_variant.combo_price_cents, v_variant.combo_price_mixto_cents,
                             v_variant.combo_price_exotico_cents,
                             (case when v_suelto_exotico then 1 else 0 end) + (case when v_variant.exotico then 1 else 0 end))
            - v_paid_group;
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

