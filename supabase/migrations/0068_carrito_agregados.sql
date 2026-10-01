-- Cada vez que alguien agrega un par al carrito. cart_items no sirve para
-- contarlo: create_order borra las lineas al convertir el carrito y quitar un
-- par las borra tambien, asi que solo guarda la foto de los carritos vivos.

create table if not exists public.cart_adds (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  cart_id     uuid,
  variant_id  uuid not null references public.variants(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  quantity    int  not null check (quantity > 0),
  -- por donde entro: la ficha del producto, la tarjeta de la reja, el armador
  -- de combo, o 'historico' para lo reconstruido abajo
  origen      text check (origen in ('ficha', 'tarjeta', 'combo', 'historico'))
);

create index if not exists cart_adds_created_idx on public.cart_adds (created_at);
create index if not exists cart_adds_producto_idx on public.cart_adds (product_id, created_at);

-- Solo escribe y lee el service role (la accion del carrito y el admin).
alter table public.cart_adds enable row level security;

-- Historico aproximado: lo que sigue en carritos vivos + lo que termino en un
-- pedido (cada linea fue al menos un agregado; la fecha es la del pedido).
-- Lo que alguien agrego y luego quito no se puede recuperar.
insert into public.cart_adds (created_at, cart_id, variant_id, product_id, quantity, origen)
select ci.created_at, ci.cart_id, ci.variant_id, v.product_id, ci.quantity, 'historico'
  from public.cart_items ci
  join public.variants v on v.id = ci.variant_id
 where ci.quantity > 0
union all
select o.created_at, null, oi.variant_id, v.product_id, oi.quantity, 'historico'
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.variants v on v.id = oi.variant_id
 where oi.quantity > 0
   and o.combo_parent_order_id is null; -- "completa tu combo" no pasa por el carrito

-- Agregados por modelo y color desde una fecha. Contado en SQL: PostgREST corta
-- en 1000 filas y agrupar en la app reportaria un pedazo como el total.
create or replace function public.carrito_agregados(p_desde timestamptz)
returns table (
  product_id  uuid,
  modelo      text,
  slug        text,
  color       text,
  agregados   bigint,  -- veces que se agrego
  pares       bigint,  -- unidades agregadas
  carritos    bigint,  -- carritos distintos
  primero     timestamptz,
  ultimo      timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.slug, v.color,
         count(*), sum(a.quantity), count(distinct a.cart_id),
         min(a.created_at), max(a.created_at)
    from cart_adds a
    join products p on p.id = a.product_id
    join variants v on v.id = a.variant_id
   where a.created_at >= p_desde
   group by p.id, p.name, p.slug, v.color
   order by count(*) desc;
$$;

revoke all on function public.carrito_agregados(timestamptz) from public, anon, authenticated;
grant execute on function public.carrito_agregados(timestamptz) to service_role;
