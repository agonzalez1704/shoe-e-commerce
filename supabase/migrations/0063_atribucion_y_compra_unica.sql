-- (1) Efectos de pago una sola vez. Dos webhooks simultaneos (o checkout con
-- tarjeta + webhook) confirmaban el mismo pago y los dos mandaban correo,
-- compra a Meta y aviso al admin. Quien sella efectos_pago_at gana; el resto
-- no repite nada. Los pedidos ya pagados se sellan: sus efectos ya salieron.
alter table orders add column if not exists efectos_pago_at timestamptz;
update orders set efectos_pago_at = coalesce(paid_at, created_at)
  where status in ('paid', 'fulfilled') and efectos_pago_at is null;

-- (2) Atribucion propia: de que campaña/anuncio vino el pedido (utm, ad_id,
-- fbclid) mas los datos con que Meta casa la compra (fbc, fbp, ip, ua).
alter table orders add column if not exists atribucion jsonb;

-- (3) Bitacora de compras enviadas a Meta: base de la reconciliacion diaria.
create table if not exists capi_envios (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders (id) on delete cascade,
  event_id   text not null,
  ok         boolean not null,
  respuesta  text,
  created_at timestamptz not null default now()
);
create index if not exists capi_envios_order_idx on capi_envios (order_id, created_at desc);
alter table capi_envios enable row level security;
create policy capi_envios_staff on capi_envios for select using (is_admin() or has_permiso('metricas_ver'));
