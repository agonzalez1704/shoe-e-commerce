-- Reseña en 2 pasos: el 10% se gana con la reseña Y una foto/video publicado
-- en Instagram o Facebook etiquetando a la marca. Una por pedido (como el
-- cupón): enlace a la publicación o captura (historias), y la revisión de admin.
alter table orders
  add column if not exists foto_enlace  text,
  add column if not exists foto_captura text,   -- ruta en el bucket privado resena-capturas
  add column if not exists foto_estado  text check (foto_estado in ('pendiente', 'aprobada', 'rechazada')),
  add column if not exists foto_motivo  text,   -- por qué se rechazó, se le muestra al cliente
  add column if not exists foto_at      timestamptz;

create index if not exists orders_foto_pendiente_idx on orders (foto_at) where foto_estado = 'pendiente';

-- Fotos de las reseñas: públicas (salen en la ficha). Capturas de la
-- publicación: privadas, solo el admin las ve con URL firmada. Las escrituras
-- van por el servidor con service role (el cliente no tiene sesión: entra con
-- el token del pedido), así que no hay políticas de insert.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resenas', 'resenas', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('resena-capturas', 'resena-capturas', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "resenas public read" on storage.objects;
create policy "resenas public read"
  on storage.objects for select
  using (bucket_id = 'resenas');
