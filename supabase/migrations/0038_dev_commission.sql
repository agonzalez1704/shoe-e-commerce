-- Developer commission payout tracking (admin-only feature).
-- The dev is paid weekly: 50 MXN per pair sold, 100 MXN per pair from the 100th
-- pair of the week onward. This flag marks, per order, whether the dev has
-- already been paid the commission for that order's pairs. NULL = still owed.
-- The tiered amount is computed in the app from each week's cumulative pairs.
alter table orders add column if not exists dev_commission_paid_at timestamptz;
