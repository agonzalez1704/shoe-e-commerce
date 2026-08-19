-- Garantías (cambios por talla, defecto, etc.). Primer caso real: "no le
-- quedaron".
--
-- Una garantía son DOS envíos más sobre el mismo pedido: el retorno (el
-- cliente nos regresa el par, la guía viaja al revés — de su casa a la
-- bodega) y la reposición (le mandamos el nuevo). Meterle seis columnas más a
-- `orders` mezclaría tres envíos en una fila; tabla propia, una por pedido.
create table garantias (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders (id) on delete cascade unique,
  razon       text not null,               -- "No le quedó la talla", libre
  notas       text,

  -- pierna 1: el cliente nos lo regresa
  retorno_carrier   text,
  retorno_tracking  text,
  retorno_url       text,
  retorno_label_url text,
  recibido_at       timestamptz,           -- llegó a la bodega

  -- pierna 2: le enviamos la reposición
  repo_carrier   text,
  repo_tracking  text,
  repo_url       text,
  repo_label_url text,

  cerrada_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table garantias enable row level security;

-- El estado no es una columna: se deriva de qué guías existen y qué fechas hay.
-- Una columna de estado y las guías se desincronizarían a la primera.

-- Admin por permiso (convención 0043). El cliente NO lee por RLS: su vista
-- pasa por /rastrear y /cuenta, que ya validan pedido+correo o sesión en el
-- servidor con service role.
create policy garantias_admin_read on garantias
  for select using (is_admin() or has_permiso('pedidos_ver') or has_permiso('pedidos_gestionar'));
create policy garantias_admin_write on garantias
  for all using (is_admin() or has_permiso('pedidos_gestionar'))
  with check (is_admin() or has_permiso('pedidos_gestionar'));
