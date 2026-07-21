-- Web Push subscriptions for the admin PWA. One row per device/browser: the
-- endpoint is the push service URL and the keys encrypt the payload for it.
create table if not exists push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Admins manage their own devices; the service role (server-side sender) bypasses RLS.
create policy push_own on push_subscriptions for all
  using (user_id = auth.uid() and is_admin())
  with check (user_id = auth.uid() and is_admin());
