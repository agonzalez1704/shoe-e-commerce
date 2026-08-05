import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Permiso } from "@/lib/permissions";

// The permission set granted by the caller's role. Empty when signed out or
// when a staff row has no role yet. Read with the service role: admin_users and
// role_permissions are not exposed to a plain session for arbitrary users.
export async function permisosDe(): Promise<Set<Permiso>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await createAdminClient()
    .from("admin_users")
    .select("role_id, roles(role_permissions(permiso))")
    .eq("user_id", user.id)
    .maybeSingle();

  const roles = (data as { roles: { role_permissions: { permiso: string }[] } | null } | null)?.roles;
  return new Set((roles?.role_permissions ?? []).map((p) => p.permiso as Permiso));
}

export function concede(perms: Set<Permiso>, permiso: Permiso): boolean {
  return perms.has("admin_total") || perms.has(permiso);
}

// Page guard: bounce out unless the role grants `permiso` (admin_total passes
// everything). Server components only.
export async function requirePagePermiso(permiso: Permiso, to = "/admin") {
  const perms = await permisosDe();
  if (!concede(perms, permiso)) redirect(to);
  return perms;
}

// Server-action guard: throws rather than redirecting. UI gating is not access
// control — every action that a limited role could reach needs this.
export async function assertPermiso(permiso: Permiso): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const perms = await permisosDe();
  if (!concede(perms, permiso)) throw new Error("No tienes permiso para esta acción");
  return user.id;
}
