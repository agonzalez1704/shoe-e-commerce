-- ============================================================
-- Phase 0 — core schema for shoe store
-- Postgres / Supabase. Money = integer cents (bigint). Single currency at launch.
-- ============================================================

create extension if not exists "pg_trgm";      -- fuzzy / catalog search
create extension if not exists "moddatetime";   -- updated_at triggers

-- ---------- enums ----------
create type product_status as enum ('draft', 'active', 'archived');
create type variant_status as enum ('active', 'inactive');
create type size_system    as enum ('US', 'EU', 'UK');
create type width_type      as enum ('narrow', 'medium', 'wide');
create type order_status     as enum ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');
create type return_type      as enum ('refund', 'exchange');
create type return_status    as enum ('requested', 'approved', 'received', 'completed', 'rejected');
create type fit_feedback     as enum ('runs_small', 'true_to_size', 'runs_large');
create type discount_type    as enum ('percent', 'fixed');

-- ============================================================
-- identity / customer
-- ============================================================
create table customers (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);

create table addresses (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references customers (id) on delete cascade,
  line1               text not null,
  line2               text,
  city                text not null,
  region              text,
  postal              text,
  country             text not null,
  is_default_shipping boolean not null default false,
  is_default_billing  boolean not null default false,
  created_at          timestamptz not null default now()
);
create index on addresses (customer_id);

-- staff allow-list for admin RLS (see 0002_rls.sql)
create table admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================
-- catalog
-- ============================================================
create table brands (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      text not null unique,
  parent_id uuid references categories (id) on delete set null
);

create table products (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid references brands (id) on delete set null,
  name             text not null,
  slug             text not null unique,
  description      text,
  gender           text,                       -- mens | womens | kids | unisex
  base_price_cents bigint not null check (base_price_cents >= 0),
  status           product_status not null default 'draft',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on products (brand_id);
create index on products (status);
create index on products using gin (name gin_trgm_ops);

create table product_categories (
  product_id  uuid not null references products (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  primary key (product_id, category_id)
);

create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  url        text not null,
  alt        text,
  color      text,            -- ties an image to a variant color
  position   int not null default 0
);
create index on product_images (product_id);

create table variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  sku         text not null unique,
  barcode     text,
  size_value  text not null,                 -- e.g. '10', '10.5'
  size_system size_system not null default 'US',
  width       width_type not null default 'medium',
  color       text not null,
  price_cents bigint check (price_cents >= 0),  -- null = inherit product.base_price_cents
  status      variant_status not null default 'active',
  created_at  timestamptz not null default now(),
  unique (product_id, size_value, width, color)
);
create index on variants (product_id);

create table inventory (
  variant_id   uuid primary key references variants (id) on delete cascade,
  qty_on_hand  int not null default 0 check (qty_on_hand >= 0),
  qty_reserved int not null default 0 check (qty_reserved >= 0),
  reorder_level int not null default 0,
  location     text not null default 'main',
  updated_at   timestamptz not null default now(),
  check (qty_reserved <= qty_on_hand)
);

-- ============================================================
-- cart
-- ============================================================
create table carts (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references customers (id) on delete cascade,  -- null = guest
  session_token text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on carts (customer_id);
create index on carts (session_token);

create table cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references carts (id) on delete cascade,
  variant_id uuid not null references variants (id) on delete cascade,
  quantity   int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

-- ============================================================
-- orders  (snapshot address + line items; never FK to live price)
-- ============================================================
create table orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  customer_id      uuid references customers (id) on delete set null,
  email            text not null,
  status           order_status not null default 'pending',
  subtotal_cents   bigint not null default 0,
  tax_cents        bigint not null default 0,
  shipping_cents   bigint not null default 0,
  total_cents      bigint not null default 0,
  currency         text not null default 'USD',
  shipping_address jsonb,           -- snapshot, not FK
  billing_address  jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on orders (customer_id);
create index on orders (status);

create table order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders (id) on delete cascade,
  variant_id       uuid references variants (id) on delete set null,  -- nullable: keep history if variant deleted
  product_name     text not null,   -- snapshot
  variant_label    text not null,   -- snapshot e.g. 'US 10 / medium / black'
  sku              text not null,   -- snapshot
  unit_price_cents bigint not null,
  quantity         int not null check (quantity > 0),
  line_total_cents bigint not null
);
create index on order_items (order_id);

create table payments (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references orders (id) on delete cascade,
  stripe_payment_intent_id text unique,
  amount_cents             bigint not null,
  status                   text not null,
  method                   text,
  created_at               timestamptz not null default now()
);
create index on payments (order_id);

create table shipments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders (id) on delete cascade,
  carrier         text,
  tracking_number text,
  status          text,
  shipped_at      timestamptz
);
create index on shipments (order_id);

-- ============================================================
-- returns / exchanges
-- ============================================================
create table returns (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders (id) on delete cascade,
  customer_id     uuid references customers (id) on delete set null,
  type            return_type not null,
  status          return_status not null default 'requested',
  reason          text,
  stripe_refund_id text,
  created_at      timestamptz not null default now()
);
create index on returns (order_id);

create table return_items (
  id                  uuid primary key default gen_random_uuid(),
  return_id           uuid not null references returns (id) on delete cascade,
  order_item_id       uuid not null references order_items (id) on delete cascade,
  quantity            int not null check (quantity > 0),
  exchange_variant_id uuid references variants (id) on delete set null  -- target size on exchange
);
create index on return_items (return_id);

-- ============================================================
-- growth
-- ============================================================
create table restock_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references variants (id) on delete cascade,
  email       text not null,
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (variant_id, email)
);

create table wishlists (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references wishlists (id) on delete cascade,
  variant_id  uuid not null references variants (id) on delete cascade,
  unique (wishlist_id, variant_id)
);

create table reviews (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products (id) on delete cascade,
  customer_id      uuid references customers (id) on delete set null,
  rating           int not null check (rating between 1 and 5),
  body             text,
  fit_feedback     fit_feedback,
  verified_purchase boolean not null default false,
  created_at       timestamptz not null default now()
);
create index on reviews (product_id);

create table discount_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  type              discount_type not null,
  value             bigint not null,        -- percent (0-100) or fixed cents
  min_subtotal_cents bigint not null default 0,
  max_uses          int,
  used_count        int not null default 0,
  starts_at         timestamptz,
  expires_at        timestamptz,
  active            boolean not null default true
);

-- ---------- updated_at triggers ----------
create trigger t_products_upd  before update on products  for each row execute function moddatetime (updated_at);
create trigger t_carts_upd     before update on carts     for each row execute function moddatetime (updated_at);
create trigger t_orders_upd    before update on orders    for each row execute function moddatetime (updated_at);
create trigger t_inventory_upd before update on inventory for each row execute function moddatetime (updated_at);

-- ---------- auto-create customer row on signup ----------
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.customers (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
