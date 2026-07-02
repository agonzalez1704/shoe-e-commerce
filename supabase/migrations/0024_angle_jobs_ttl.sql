-- ============================================================
-- TTL for angle_jobs. Generation takes ~8 min; if no webhook lands within a
-- generous window the job is dead (lost webhook, provider error) — fail it so
-- the UI stops spinning. Also prune old terminal rows so the table stays lean.
-- ============================================================

create or replace function public.expire_stale_angle_jobs()
returns void language sql security definer set search_path = public as $$
  -- 1) reap stuck jobs
  update angle_jobs
     set status = 'failed',
         error  = coalesce(error, 'La generación expiró sin respuesta de auto-toon.')
   where status = 'processing'
     and created_at < now() - interval '20 minutes';

  -- 2) retention: drop finished jobs after a week
  delete from angle_jobs
   where status in ('ready', 'failed')
     and created_at < now() - interval '7 days';
$$;

-- run every 5 minutes (mirrors expire-pending-orders)
select cron.schedule(
  'expire-stale-angle-jobs',
  '*/5 * * * *',
  $$ select public.expire_stale_angle_jobs(); $$
);

-- to remove:  select cron.unschedule('expire-stale-angle-jobs');
