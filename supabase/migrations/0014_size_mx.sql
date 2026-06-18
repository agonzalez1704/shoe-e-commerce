-- ============================================================
-- Mexican market uses MX shoe sizing ("punto" 24, 25, 26…), not US.
-- Add MX to the size_system enum. Must be its own migration: a new enum value
-- can't be referenced in the same transaction it's added in.
-- ============================================================
alter type size_system add value if not exists 'MX';
