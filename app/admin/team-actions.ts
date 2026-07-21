"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export type TeamMember = {
  userId: string;
  email: string;
  addedAt: string;
  devices: number; // push subscriptions -> whether they'd actually get alerts
  isSelf: boolean;
};

export async function listTeam(): Promise<TeamMember[]> {
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient(); // needs to read other people's emails/devices
  const { data: admins } = await admin.from("admin_users").select("user_id, created_at").order("created_at");
  const ids = (admins ?? []).map((a) => a.user_id);
  if (!ids.length) return [];

  const [{ data: people }, { data: subs }] = await Promise.all([
    admin.from("customers").select("id, email").in("id", ids),
    admin.from("push_subscriptions").select("user_id").in("user_id", ids),
  ]);

  const emailOf = new Map((people ?? []).map((p) => [p.id, p.email]));
  const deviceCount = new Map<string, number>();
  for (const s of subs ?? []) deviceCount.set(s.user_id, (deviceCount.get(s.user_id) ?? 0) + 1);

  return (admins ?? []).map((a) => ({
    userId: a.user_id,
    email: emailOf.get(a.user_id) ?? "(sin correo)",
    addedAt: a.created_at,
    devices: deviceCount.get(a.user_id) ?? 0,
    isSelf: a.user_id === user?.id,
  }));
}

// The person must already have an account (they sign up at /cuenta); this only
// grants the admin role, it never creates credentials.
export async function addAdminByEmail(email: string) {
  const supabase = await requireAdmin();
  const clean = email.trim().toLowerCase();
  if (!clean) throw new Error("Escribe un correo.");

  const admin = createAdminClient();
  const { data: person } = await admin.from("customers").select("id").eq("email", clean).maybeSingle();
  if (!person) {
    throw new Error("No hay ninguna cuenta con ese correo. Pídele que se registre en /cuenta primero.");
  }

  const { error } = await supabase.from("admin_users").upsert({ user_id: person.id }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/ajustes");
}

export async function removeAdmin(userId: string) {
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  // refuse to strip your own access — that could lock everyone out
  if (user?.id === userId) throw new Error("No puedes quitarte a ti mismo el acceso.");

  const { error } = await supabase.from("admin_users").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/ajustes");
}
