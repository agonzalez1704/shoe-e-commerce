-- ============================================================
-- WhatsApp sales assistant (Kapso). Conversation history + per-number state.
-- Accessed only by the webhook via the service-role client (RLS default-deny).
-- Asesores (human handoff numbers) come from env, not a table.
-- ============================================================

create table wa_mensajes (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index wa_mensajes_phone_idx on wa_mensajes (phone, created_at desc);

create table conversaciones (
  phone      text primary key,
  estado     text not null default 'bot' check (estado in ('bot', 'asesor')),
  motivo     text,
  updated_at timestamptz not null default now()
);

alter table wa_mensajes    enable row level security;  -- no policies: service-role only
alter table conversaciones enable row level security;
