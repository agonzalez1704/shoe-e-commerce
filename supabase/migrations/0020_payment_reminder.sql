-- ============================================================
-- Abandoned-checkout recovery: one "completa tu pago" reminder per pending
-- OXXO/SPEI order whose voucher is still valid but unpaid after a few hours.
-- ============================================================
alter table orders add column if not exists reminder_sent_at timestamptz;
