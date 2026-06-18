-- ============================================================
-- Phase 2 — scheduled cleanup. Releases stock held by pending orders
-- whose voucher/reservation window lapsed (OXXO/SPEI never paid, card abandoned).
-- ============================================================
create extension if not exists pg_cron;

-- run every 5 minutes
select cron.schedule(
  'expire-pending-orders',
  '*/5 * * * *',
  $$ select public.expire_pending_orders(); $$
);

-- to remove:  select cron.unschedule('expire-pending-orders');
