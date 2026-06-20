-- ============================================================
-- Verified-buyer reviews. Checkout is mostly guest, so proof-of-purchase is a
-- per-order token (emailed in the review request) rather than a login. Reviews
-- submitted via that token are verified_purchase = true.
-- ============================================================

alter table orders add column if not exists review_token uuid not null default gen_random_uuid();

alter table reviews add column if not exists order_id uuid references orders (id) on delete set null;

-- one review per product per order (lets a buyer edit, blocks spam)
create unique index if not exists reviews_order_product_uniq
  on reviews (order_id, product_id) where order_id is not null;

create index if not exists reviews_product_idx on reviews (product_id);
