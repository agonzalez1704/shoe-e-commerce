-- ============================================================
-- Product image storage. Public read (served via CDN public URL),
-- writes restricted to admins. 5MB cap, common image types only.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- RLS on storage.objects is enabled by Supabase. Scope policies to this bucket.
create policy "product images public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product images admin insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product images admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

create policy "product images admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
