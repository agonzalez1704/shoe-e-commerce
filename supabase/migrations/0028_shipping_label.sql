-- Skydropx shipping label URL (PDF) generated from the admin fulfillment panel.
-- carrier / tracking_number / tracking_url already exist (migration 0027).
alter table orders add column if not exists shipping_label_url text;
