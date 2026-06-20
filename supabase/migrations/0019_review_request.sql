-- ============================================================
-- Track review-request emails so the scheduler sends one per order, once,
-- a few days after fulfillment.
-- ============================================================
alter table orders add column if not exists review_request_sent_at timestamptz;
