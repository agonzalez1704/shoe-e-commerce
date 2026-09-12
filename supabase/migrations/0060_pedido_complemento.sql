-- Completar combo despues de comprar: un pedido "complemento" cobra solo la
-- diferencia entre lo pagado por el par suelto y el precio del combo, y queda
-- ligado al pedido original. El estado se deriva: un hijo activo = combo en
-- proceso; hijo pagado = combo completado.

alter table orders add column if not exists combo_parent_order_id uuid references orders (id);
create index if not exists orders_combo_parent_idx on orders (combo_parent_order_id) where combo_parent_order_id is not null;

-- Crea (o devuelve, si ya existe uno pendiente) el pedido complemento.
-- security definer: lo invoca el servidor con la verdad de precios en la base;
-- el navegador solo aporta que variante quiere.
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
   where v.id = p_variant_id and v.status = 'active';
  if v_variant.id is null or v_variant.combo_group is null then
    raise exception 'Ese par no participa en el combo';
  end if;

  -- unidades del pool ya comparadas en el pedido original y lo pagado por las sueltas
  select coalesce(sum(oi.quantity), 0), coalesce(sum(oi.line_total_cents), 0)
    into v_units, v_paid_group
    from order_items oi
    join variants vv on vv.id = oi.variant_id
    join products pp on pp.id = vv.product_id
   where oi.order_id = p_parent_order_id and pp.combo_group = v_variant.combo_group;

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
