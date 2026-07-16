-- ============================================================
-- Order fulfillment + delivery tracking. `status` stays the payment lifecycle
-- (pending/paid/…); a separate fulfillment pipeline tracks the physical journey
-- of a made-to-order pair: en producción → listo → enviado → entregado, plus
-- carrier / tracking / estimated delivery for the admin delivery dashboard.
-- ============================================================

alter table orders
  add column if not exists fulfillment_stage text not null default 'pending',
  add column if not exists carrier            text,
  add column if not exists tracking_number    text,
  add column if not exists tracking_url       text,
  add column if not exists estimated_delivery date,
  add column if not exists shipped_at         timestamptz,
  add column if not exists delivered_at       timestamptz;

alter table orders drop constraint if exists orders_fulfillment_stage_ck;
alter table orders add constraint orders_fulfillment_stage_ck
  check (fulfillment_stage in ('pending', 'in_production', 'ready', 'shipped', 'delivered'));

-- backfill existing rows from the payment status
update orders set fulfillment_stage =
  case
    when status = 'fulfilled' then 'shipped'
    when status = 'paid'      then 'in_production'
    else 'pending'
  end
where fulfillment_stage = 'pending';

create index if not exists orders_fulfillment_stage_idx on orders (fulfillment_stage);
