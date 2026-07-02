-- ============================================================
-- Async product-angle (auto-toon) jobs.
-- Browser starts a job; the auto-toon webhook completes it (service_role);
-- Supabase Realtime pushes the row change back to the admin UI. Admin-only.
-- ============================================================

create table angle_jobs (
  id           uuid primary key default gen_random_uuid(),
  toon_set_id  text unique not null,                         -- auto-toon angleSetId
  product_id   uuid references products (id) on delete set null,
  product_name text,
  source_url   text not null,
  status       text not null default 'processing'
                 check (status in ('processing', 'ready', 'failed')),
  result_urls  text[] not null default '{}',                 -- re-hosted image URLs
  error        text,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index angle_jobs_status_idx on angle_jobs (status, created_at desc);

-- bump updated_at on every change (so Realtime UPDATE always carries a fresh ts)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger angle_jobs_touch
  before update on angle_jobs
  for each row execute function public.touch_updated_at();

-- RLS: admins only. The webhook writer uses service_role, which bypasses RLS.
alter table angle_jobs enable row level security;
create policy adm_angle_jobs on angle_jobs
  for all using (is_admin()) with check (is_admin());

grant select, insert, update on angle_jobs to authenticated;
grant all on angle_jobs to service_role;

-- expose to Realtime so the admin browser gets postgres_changes (RLS-filtered)
alter publication supabase_realtime add table angle_jobs;
