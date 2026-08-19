-- Favoritos del comprador, para el corazón de las tarjetas.
--
-- Existe `wishlists`/`wishlist_items` desde 0001, pero apunta a variant_id
-- (talla+color) y nunca se usó. El corazón marca un colorway —"Napoli moka"—
-- no una talla, así que se guarda producto+color directo, sin la indirección
-- de dos tablas. Las de wishlist se quedan como están: borrarlas no gana nada.
create table favoritos (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  product_id  uuid not null references products (id) on delete cascade,
  color       text,                    -- null = producto sin colorways
  created_at  timestamptz not null default now(),
  unique (customer_id, product_id, color)
);

alter table favoritos enable row level security;

-- Cada quien lo suyo: leer, marcar y quitar. No hay lectura pública ni admin —
-- si mañana marketing quiere agregados, eso pasa por service role.
create policy favoritos_propios on favoritos
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
