-- Roles as DATA (ported from the inventory-pos model, adapted to Supabase Auth).
--
-- Until now staff access was binary: a row in admin_users meant full control.
-- This makes roles editable — a `roles` table plus a `role_permissions` map, so
-- an admin composes a role out of permission KEYS. The keys stay code-defined:
-- each one gates a capability the app actually checks, so nobody can invent a
-- key that nothing honors.
--
-- is_admin() backs 67 RLS policies across 28 tables, so it changes meaning
-- carefully and FAILS CLOSED: it now requires the `admin_total` permission.
-- Every existing admin is backfilled to Dueño (which holds it), so today's
-- access is unchanged. A limited role therefore has NO write power through RLS
-- until a capability is granted explicitly in the app layer — the safe default.
--
-- is_staff() is the new "may open /admin at all" check.

create table if not exists roles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  is_system   boolean not null default false,   -- built-ins can't be deleted
  created_at  timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permiso text not null,
  primary key (role_id, permiso)
);

alter table admin_users add column if not exists role_id uuid references roles(id);
create index if not exists admin_users_role_idx on admin_users (role_id);

-- ---- built-in roles ----
insert into roles (slug, name, description, is_system) values
  ('dueno',   'Dueño',    'Control total de la tienda.',                            true),
  ('gerente', 'Gerente',  'Opera la tienda: pedidos, catálogo y marketing.',        true),
  ('almacen', 'Almacén',  'Prepara pedidos y mantiene el inventario.',              true),
  ('soporte', 'Atención', 'Atiende clientes y da seguimiento a los pedidos.',       true)
on conflict (slug) do nothing;

with perms(slug, permiso) as (values
  -- Dueño: todo.
  ('dueno','admin_total'), ('dueno','pedidos_ver'), ('dueno','pedidos_gestionar'),
  ('dueno','facturar'), ('dueno','productos_gestionar'), ('dueno','inventario_ver'),
  ('dueno','inventario_gestionar'), ('dueno','descuentos_gestionar'),
  ('dueno','promociones_gestionar'), ('dueno','metricas_ver'), ('dueno','comisiones_ver'),
  ('dueno','usuarios_gestionar'), ('dueno','ajustes_gestionar'),
  -- Gerente: opera todo menos comisiones, usuarios y ajustes.
  ('gerente','pedidos_ver'), ('gerente','pedidos_gestionar'), ('gerente','facturar'),
  ('gerente','productos_gestionar'), ('gerente','inventario_ver'),
  ('gerente','inventario_gestionar'), ('gerente','descuentos_gestionar'),
  ('gerente','promociones_gestionar'), ('gerente','metricas_ver'),
  -- Almacén: surtido e inventario.
  ('almacen','pedidos_ver'), ('almacen','pedidos_gestionar'),
  ('almacen','inventario_ver'), ('almacen','inventario_gestionar'),
  -- Atención: seguimiento de pedidos.
  ('soporte','pedidos_ver'), ('soporte','pedidos_gestionar')
)
insert into role_permissions (role_id, permiso)
select r.id, perms.permiso from perms join roles r on r.slug = perms.slug
on conflict do nothing;

-- ---- every current admin keeps full access ----
update admin_users
   set role_id = (select id from roles where slug = 'dueno')
 where role_id is null;

-- ---- checks ----
-- May this user open the admin at all?
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- Full control. Keeps the same name so all 67 policies keep compiling, but now
-- reads the permission, so a custom "full control" role counts too.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users au
    join role_permissions rp on rp.role_id = au.role_id
    where au.user_id = auth.uid() and rp.permiso = 'admin_total'
  );
$$;

-- Does the caller hold a given permission? admin_total passes everything.
create or replace function public.has_permiso(p_permiso text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users au
    join role_permissions rp on rp.role_id = au.role_id
    where au.user_id = auth.uid()
      and rp.permiso in (p_permiso, 'admin_total')
  );
$$;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.has_permiso(text) to authenticated;

-- roles/role_permissions are read by staff, written only through server actions
-- on the service-role client.
alter table roles            enable row level security;
alter table role_permissions enable row level security;
create policy roles_read      on roles            for select using (is_staff());
create policy role_perms_read on role_permissions for select using (is_staff());
