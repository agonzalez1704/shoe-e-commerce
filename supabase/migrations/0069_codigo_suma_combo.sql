-- Codigos que se suman al combo. El de carrito abandonado da 5% sobre el
-- precio ya con combo; los demas siguen ganando "el mejor de los dos" (0066).
-- Ademas: un codigo por carrito, de un uso y con vencimiento (el cron lo crea).

alter table public.discount_codes
  add column if not exists suma_combo boolean not null default false;

CREATE OR REPLACE FUNCTION public.create_order(p_cart_id uuid, p_email text, p_payment_method payment_method, p_shipping jsonb DEFAULT NULL::jsonb, p_billing jsonb DEFAULT NULL::jsonb, p_discount_code text DEFAULT NULL::text, p_needs_invoice boolean DEFAULT false)
 RETURNS TABLE(order_id uuid, order_number text, subtotal_cents bigint, discount_cents bigint, tax_cents bigint, total_cents bigint, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- Un codigo marcado suma_combo (el de carrito abandonado) se aplica
      -- sobre el precio ya con combo: 2x$1,999 con 5% = $1,899.
      if v_disc.suma_combo then
        v_discount := v_combo + case when v_disc.type = 'percent'
                         then ((v_subtotal - v_combo) * v_disc.value) / 100
                         else least(v_disc.value, v_subtotal - v_combo) end;
      else
        v_discount := greatest(v_combo, case when v_disc.type = 'percent'
                           then (v_subtotal * v_disc.value) / 100
                           else least(v_disc.value, v_subtotal) end);
      end if;
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
$function$;

-- REGRESA10 era publico, sin tope ni vencimiento, y nunca se uso (el correo no
-- salia por un bug del cron): se apaga.
update public.discount_codes set active = false where code = 'REGRESA10';
