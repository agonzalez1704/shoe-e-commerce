"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermiso } from "@/lib/permisos-guard";
import { PERMISOS, type Permiso } from "@/lib/permissions";

export type RolRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permisos: Permiso[];
  usuarios: number;
};

export type UsuarioRow = {
  userId: string;
  email: string;
  nombre: string | null;
  roleId: string | null;
  rol: string | null;
  isSelf: boolean;
  addedAt: string;
};

// Server actions return {error} rather than throwing: Next strips thrown
// messages in production, which would leave the admin staring at a generic
// digest instead of "ese correo ya existe".
export type Res = { ok: true } | { ok: false; error: string };

const fail = (e: unknown): Res => ({ ok: false, error: e instanceof Error ? e.message : "Algo salió mal" });

export async function listUsuarios(): Promise<UsuarioRow[]> {
  await assertPermiso("usuarios_gestionar");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_users")
    .select("user_id, created_at, role_id, roles(name)")
    .order("created_at");
  const rows = (data ?? []) as unknown as {
    user_id: string; created_at: string; role_id: string | null; roles: { name: string } | null;
  }[];
  if (!rows.length) return [];

  const { data: people } = await admin
    .from("customers")
    .select("id, email, full_name")
    .in("id", rows.map((r) => r.user_id));
  const info = new Map((people ?? []).map((p) => [p.id, p]));

  return rows.map((r) => ({
    userId: r.user_id,
    email: info.get(r.user_id)?.email ?? "—",
    nombre: info.get(r.user_id)?.full_name ?? null,
    roleId: r.role_id,
    rol: r.roles?.name ?? null,
    isSelf: r.user_id === user?.id,
    addedAt: r.created_at,
  }));
}

export async function listRoles(): Promise<RolRow[]> {
  await assertPermiso("usuarios_gestionar");
  const admin = createAdminClient();
  const { data } = await admin
    .from("roles")
    .select("id, slug, name, description, is_system, role_permissions(permiso), admin_users(user_id)")
    .order("name");
  return ((data ?? []) as unknown as {
    id: string; slug: string; name: string; description: string | null; is_system: boolean;
    role_permissions: { permiso: string }[]; admin_users: { user_id: string }[];
  }[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    isSystem: r.is_system,
    permisos: r.role_permissions.map((p) => p.permiso as Permiso),
    usuarios: r.admin_users.length,
  }));
}

// Create the account outright instead of waiting for the person to sign up.
// email_confirm skips the verification mail so they can sign in immediately.
export async function crearUsuario(input: {
  email: string; password: string; nombre: string; roleId: string;
}): Promise<Res> {
  try {
    await assertPermiso("usuarios_gestionar");
    const email = input.email.trim().toLowerCase();
    const nombre = input.nombre.trim();
    if (!email) throw new Error("Escribe un correo.");
    if (input.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
    if (!input.roleId) throw new Error("Elige un rol.");

    const admin = createAdminClient();
    const { data: existing } = await admin.from("customers").select("id").eq("email", email).maybeSingle();

    // Already has a storefront account? Just grant staff access instead of failing.
    let userId = existing?.id ?? null;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: nombre || null },
      });
      if (error) throw new Error(error.message);
      userId = data.user?.id ?? null;
    }
    if (!userId) throw new Error("No se pudo crear la cuenta.");

    const { error } = await admin
      .from("admin_users")
      .upsert({ user_id: userId, role_id: input.roleId }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function cambiarRolUsuario(userId: string, roleId: string): Promise<Res> {
  try {
    const meId = await assertPermiso("usuarios_gestionar");
    // Changing your own role can strip your own admin_total and lock you out.
    if (userId === meId) throw new Error("No puedes cambiar tu propio rol. Pídeselo a otro administrador.");

    const admin = createAdminClient();
    const { error } = await admin.from("admin_users").update({ role_id: roleId }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function quitarAcceso(userId: string): Promise<Res> {
  try {
    const meId = await assertPermiso("usuarios_gestionar");
    if (userId === meId) throw new Error("No puedes quitarte a ti mismo el acceso.");

    const admin = createAdminClient();
    // never leave the store without anyone holding full control
    const { count } = await admin
      .from("admin_users")
      .select("user_id, roles!inner(role_permissions!inner(permiso))", { count: "exact", head: true })
      .eq("roles.role_permissions.permiso", "admin_total")
      .neq("user_id", userId);
    if (!count) throw new Error("Es el único usuario con control total. Asigna otro antes de quitarle el acceso.");

    const { error } = await admin.from("admin_users").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) { return fail(e); }
}

function limpiaPermisos(permisos: string[]): Permiso[] {
  // only keys the code honors — an unknown key would be a permission nothing checks
  return [...new Set(permisos)].filter((p): p is Permiso => (PERMISOS as readonly string[]).includes(p));
}

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function crearRol(input: { name: string; description: string; permisos: string[] }): Promise<Res> {
  try {
    await assertPermiso("usuarios_gestionar");
    const name = input.name.trim();
    if (!name) throw new Error("Ponle nombre al rol.");
    const permisos = limpiaPermisos(input.permisos);
    if (!permisos.length) throw new Error("Elige al menos un permiso.");

    const admin = createAdminClient();
    const { data: rol, error } = await admin
      .from("roles")
      .insert({ slug: slugify(name), name, description: input.description.trim() || null })
      .select("id")
      .single();
    if (error || !rol) throw new Error(error?.message ?? "No se pudo crear el rol");

    const { error: e2 } = await admin
      .from("role_permissions")
      .insert(permisos.map((permiso) => ({ role_id: rol.id, permiso })));
    if (e2) throw new Error(e2.message);

    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function actualizarRol(
  roleId: string,
  input: { name: string; description: string; permisos: string[] },
): Promise<Res> {
  try {
    const meId = await assertPermiso("usuarios_gestionar");
    const permisos = limpiaPermisos(input.permisos);
    if (!permisos.length) throw new Error("Elige al menos un permiso.");

    const admin = createAdminClient();
    // Don't let someone quietly drop full control from the role they're standing on.
    const { data: me } = await admin.from("admin_users").select("role_id").eq("user_id", meId).maybeSingle();
    if (me?.role_id === roleId && !permisos.includes("admin_total")) {
      throw new Error("Ese es tu propio rol: no puedes quitarle el control total.");
    }

    const { error } = await admin
      .from("roles")
      .update({ name: input.name.trim(), description: input.description.trim() || null })
      .eq("id", roleId);
    if (error) throw new Error(error.message);

    await admin.from("role_permissions").delete().eq("role_id", roleId);
    const { error: e2 } = await admin
      .from("role_permissions")
      .insert(permisos.map((permiso) => ({ role_id: roleId, permiso })));
    if (e2) throw new Error(e2.message);

    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function eliminarRol(roleId: string): Promise<Res> {
  try {
    await assertPermiso("usuarios_gestionar");
    const admin = createAdminClient();

    const { data: rol } = await admin.from("roles").select("is_system").eq("id", roleId).maybeSingle();
    if (rol?.is_system) throw new Error("Los roles del sistema no se pueden eliminar.");

    const { count } = await admin
      .from("admin_users")
      .select("user_id", { count: "exact", head: true })
      .eq("role_id", roleId);
    if (count) throw new Error(`Hay ${count} usuario(s) con ese rol. Reasígnalos primero.`);

    const { error } = await admin.from("roles").delete().eq("id", roleId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) { return fail(e); }
}
