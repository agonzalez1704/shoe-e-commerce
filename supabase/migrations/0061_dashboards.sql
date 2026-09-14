-- Dashboards generativos: el spec es un documento JSON declarativo que compone
-- primitivas (kpi, serie, distribucion, tabla, nota) sobre un DSL de consulta
-- acotado. El modelo compone specs; los datos se consultan al render con las
-- fuentes whitelisted del servidor — nunca SQL del modelo.

create table if not exists dashboards (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  spec        jsonb not null,
  creado_por  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Historial: cada guardado empuja la version anterior. Volver = copiar de aqui.
create table if not exists dashboards_versiones (
  id           uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references dashboards (id) on delete cascade,
  spec         jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists dashboards_versiones_idx on dashboards_versiones (dashboard_id, created_at desc);

alter table dashboards enable row level security;
alter table dashboards_versiones enable row level security;
create policy dashboards_staff on dashboards for all
  using (is_admin() or has_permiso('metricas_ver'))
  with check (is_admin() or has_permiso('metricas_ver'));
create policy dashboards_versiones_staff on dashboards_versiones for all
  using (is_admin() or has_permiso('metricas_ver'))
  with check (is_admin() or has_permiso('metricas_ver'));
