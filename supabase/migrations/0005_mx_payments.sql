-- ============================================================
-- Phase 2 — Mexican payments (Conekta) + CFDI invoicing.
-- Methods: card (instant), oxxo (cash voucher, ~3 days), spei (bank transfer).
-- OXXO/SPEI are ASYNCHRONOUS: order is created 'pending' with a voucher/CLABE,
-- stock stays reserved until the webhook confirms payment or the order expires.
-- Money = centavos (bigint). Currency = MXN. Prices are IVA-inclusive (16%).
-- ============================================================

create type payment_method as enum ('card', 'oxxo', 'spei');

-- ---------- orders: method + expiry + MXN default ----------
alter table orders add column if not exists payment_method payment_method;
alter table orders add column if not exists expires_at timestamptz;  -- reservation / voucher deadline
alter table orders alter column currency set default 'MXN';

-- ---------- payments: provider-agnostic, async-aware ----------
alter table payments rename column stripe_payment_intent_id to provider_charge_id;
alter table payments add column if not exists provider    text not null default 'conekta';
alter table payments add column if not exists method      payment_method;
alter table payments add column if not exists reference   text;        -- OXXO barcode / reference
alter table payments add column if not exists clabe       text;        -- SPEI target CLABE
alter table payments add column if not exists voucher_url text;        -- hosted voucher / receipt
alter table payments add column if not exists expires_at  timestamptz;
alter table payments alter column status set default 'pending';

-- ============================================================
-- CFDI (facturación SAT 4.0)
-- ============================================================
create type cfdi_status as enum ('pending', 'stamped', 'failed', 'cancelled');

-- fiscal data captured at checkout when buyer wants an invoice
create table order_fiscal_data (
  order_id      uuid primary key references orders (id) on delete cascade,
  rfc           text not null,
  fiscal_name   text not null,            -- razón social / nombre
  fiscal_regime text not null,            -- régimen fiscal (clave SAT)
  cfdi_use      text not null,            -- uso CFDI (clave SAT, e.g. G03)
  postal_code   text not null,            -- código postal fiscal
  email         text not null,
  created_at    timestamptz not null default now()
);

-- stamped invoice(s) returned by the PAC (Facturama etc.)
create table cfdi_documents (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders (id) on delete cascade,
  status      cfdi_status not null default 'pending',
  uuid_fiscal text,                       -- folio fiscal (UUID from SAT)
  xml_url     text,
  pdf_url     text,
  pac_error   text,
  stamped_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index on cfdi_documents (order_id);

-- mark orders that requested an invoice
alter table orders add column if not exists needs_invoice boolean not null default false;

-- ---------- RLS for new tables ----------
alter table order_fiscal_data enable row level security;
alter table cfdi_documents    enable row level security;

create policy own_fiscal_read on order_fiscal_data for select
  using (exists (select 1 from orders o where o.id = order_fiscal_data.order_id
                 and (o.customer_id = auth.uid() or is_admin())));
create policy own_fiscal_ins on order_fiscal_data for insert
  with check (exists (select 1 from orders o where o.id = order_fiscal_data.order_id
                      and o.customer_id = auth.uid()));
create policy adm_fiscal on order_fiscal_data for all using (is_admin()) with check (is_admin());

create policy own_cfdi_read on cfdi_documents for select
  using (exists (select 1 from orders o where o.id = cfdi_documents.order_id
                 and (o.customer_id = auth.uid() or is_admin())));
create policy adm_cfdi on cfdi_documents for all using (is_admin()) with check (is_admin());
