-- Reseñas publicas en la ficha: quien la escribio (nombre corto y ciudad, del
-- pedido), que compro (color y talla), fotos y la respuesta de la tienda.
-- Se llenan al reseñar; la lectura publica ya existe (reviews_read).
alter table reviews
  add column if not exists autor text,
  add column if not exists ciudad text,
  add column if not exists color text,
  add column if not exists talla text,
  add column if not exists fotos text[] not null default '{}',
  add column if not exists respuesta text,
  add column if not exists respuesta_at timestamptz;
