import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type Turn = { role: "user" | "assistant"; content: string };

const WINDOW_MS = 6 * 3600_000; // 6h rolling history

export async function cargarHistorial(phone: string, n = 10): Promise<Turn[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("wa_mensajes")
    .select("role, content")
    .eq("phone", phone)
    .gte("created_at", new Date(Date.now() - WINDOW_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(n);
  return (data ?? []) as Turn[];
}

export async function guardarMensaje(phone: string, role: Turn["role"], content: string) {
  const db = createAdminClient();
  await db.from("wa_mensajes").insert({ phone, role, content });
}
