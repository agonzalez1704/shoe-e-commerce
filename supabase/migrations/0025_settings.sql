-- ============================================================
-- Admin key/value settings (e.g. the logo used for auto-toon logo correction).
-- Admin-only.
-- ============================================================
create table settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table settings enable row level security;
create policy adm_settings on settings
  for all using (is_admin()) with check (is_admin());

grant select, insert, update on settings to authenticated;
grant all on settings to service_role;
