-- ============================================================
-- Security: product_images was world-readable (using true), exposing image
-- URLs for draft/archived products. Scope reads to active products (or admin),
-- matching the products/variants read policies.
-- ============================================================

drop policy if exists "cat_read_images" on product_images;

create policy cat_read_images on product_images for select
  using (
    exists (
      select 1 from products p
      where p.id = product_images.product_id
        and (p.status = 'active' or public.is_admin())
    )
  );
