import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function estadoConversacion(phone: string): Promise<"bot" | "asesor"> {
  const db = createAdminClient();
  const { data } = await db.from("conversaciones").select("estado").eq("phone", phone).maybeSingle();
  return (data?.estado as "bot" | "asesor") ?? "bot";
}

export async function marcarAsesor(phone: string, motivo: string) {
  const db = createAdminClient();
  await db.from("conversaciones").upsert(
    { phone, estado: "asesor", motivo, updated_at: new Date().toISOString() },
    { onConflict: "phone" },
  );
}

export async function devolverBot(phone: string) {
  const db = createAdminClient();
  await db.from("conversaciones").upsert(
    { phone, estado: "bot", motivo: null, updated_at: new Date().toISOString() },
    { onConflict: "phone" },
  );
}

// Human asesor WhatsApp numbers from env (comma-separated).
export function getAsesores(): string[] {
  return (process.env.KAPSO_ASESORES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
