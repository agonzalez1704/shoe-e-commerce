-- ============================================================
-- Aplazo BNPL via Conekta (payment_method type "bnpl" / "aplazo_bnpl").
-- Redirect flow like card 3DS: customer approves at Aplazo, webhook confirms.
-- Own migration: a new enum value can't be used in the same tx it's added.
-- expires_at is left NULL for aplazo (instant redirect, no voucher window).
-- ============================================================
alter type payment_method add value if not exists 'aplazo';
