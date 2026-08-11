-- Curated "Destacados", the honest fallback for a store with no sales history.
--
-- The homepage shows real best sellers ranked by units sold (0049). A brand-new
-- store has none, and relabelling its newest arrivals as favourites would be a
-- lie, so it falls back to a shelf the admin picks by hand — under a different
-- heading, so the claim always matches the data behind it.
--
-- A flag on products rather than a separate table: it is one boolean per
-- product, it rides the existing admin form and RLS, and the storefront reads
-- it with the same public select it already runs.
alter table products add column if not exists featured boolean not null default false;

-- Partial: only the handful of true rows are worth indexing.
create index if not exists products_featured_idx on products (featured) where featured;
