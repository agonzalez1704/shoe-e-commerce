-- Track the one abandoned-cart nudge per cart (logged-in users only; guests have
-- no email until checkout). Stamped by /api/cron/abandoned-carts.
alter table carts add column if not exists abandoned_email_sent_at timestamptz;
