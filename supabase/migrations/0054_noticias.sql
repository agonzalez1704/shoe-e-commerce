-- Noticias y eventos. Petición 3 del cliente de honeywhale: la banda que en la
-- referencia posiciona a la marca por encima de la competencia.
--
-- La tarjeta de la referencia es {imagen, fecha, título, categoría, enlace}. Ese
-- es todo el modelo, así que es una tabla y un formulario, no una CMS.
create table if not exists noticias (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  titulo       text not null,
  categoria    text,                -- libre: "Evento", "Lanzamiento"
  cover_url    text,
  cuerpo       text,                -- null = tarjeta que sólo enlaza
  -- Nullable en vez de un enum `status`: una sola columna sirve para
  -- borrador-vs-publicado, para el orden y para la fecha que se muestra.
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists noticias_pub_idx
  on noticias (published_at desc) where published_at is not null;

alter table noticias enable row level security;

-- Los paréntesis son estructurales: SQL liga `and` más fuerte que `or`, y sin
-- ellos todo borrador quedaría legible por anon.
create policy noticias_read on noticias for select using (
  (published_at is not null and published_at <= now())
  or is_admin() or has_permiso('contenido_gestionar')
);
create policy noticias_admin on noticias for all
  using (is_admin() or has_permiso('contenido_gestionar'))
  with check (is_admin() or has_permiso('contenido_gestionar'));

-- Sin `security definer`, a propósito. La convención del repo lo usa donde la
-- consulta filtraría filas que quien llama no puede ver — top_sellers() devuelve
-- sólo ids para que los volúmenes no salgan. Una nota publicada no esconde nada.
grant select on noticias to anon, authenticated;
grant insert, update, delete on noticias to authenticated;

-- Bug preexistente, aparte de las noticias: las políticas de Storage de 0009 son
-- `is_admin()` a secas y 0043 nunca las amplió, así que alguien con
-- `productos_gestionar` puede insertar la fila de product_images pero no subir
-- el archivo. Se amplían aquí porque las portadas de noticias reusan el mismo
-- bucket y chocarían con lo mismo.
drop policy if exists "product images admin insert" on storage.objects;
drop policy if exists "product images admin update" on storage.objects;
drop policy if exists "product images admin delete" on storage.objects;

create policy "product images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (public.is_admin() or public.has_permiso('productos_gestionar') or public.has_permiso('contenido_gestionar')));
create policy "product images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (public.is_admin() or public.has_permiso('productos_gestionar') or public.has_permiso('contenido_gestionar')));
create policy "product images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (public.is_admin() or public.has_permiso('productos_gestionar') or public.has_permiso('contenido_gestionar')));
