-- ============================================================
-- SEO copy for category landing pages (unique intro text per category).
-- ============================================================
alter table categories add column if not exists description text;
