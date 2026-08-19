"use server";

import { createClient } from "@/lib/supabase/server";

// El corazón guarda producto+color. El cliente manda el slug —es lo que la
// tarjeta tiene— y aquí se resuelve al id: un slug renombrado rompería menos
// que exponer ids en el navegador.
async function idDe(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

export async function alternarFavorito(slug: string, color: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "sin sesión" };
  const pid = await idDe(slug);
  if (!pid) return { ok: false as const, error: "producto no encontrado" };

  // RLS limita todo a las filas propias; aquí solo se decide alta o baja.
  const q = supabase.from("favoritos").select("id").eq("product_id", pid).eq("customer_id", user.id);
  const { data: ya } = await (color === null ? q.is("color", null) : q.eq("color", color)).maybeSingle();

  if (ya) {
    await supabase.from("favoritos").delete().eq("id", ya.id);
    return { ok: true as const, marcado: false };
  }
  const { error } = await supabase.from("favoritos").insert({ customer_id: user.id, product_id: pid, color });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, marcado: true };
}

// Los favoritos marcados sin cuenta viven en el navegador; al iniciar sesión
// se suben de una vez. El unique de la tabla vuelve la operación idempotente.
export async function migrarFavoritos(locales: { slug: string; color: string | null }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !locales.length) return { ok: false as const };

  const filas = [];
  for (const f of locales.slice(0, 50)) {
    const pid = await idDe(f.slug);
    if (pid) filas.push({ customer_id: user.id, product_id: pid, color: f.color });
  }
  if (filas.length) await supabase.from("favoritos").upsert(filas, { onConflict: "customer_id,product_id,color", ignoreDuplicates: true });
  return { ok: true as const, subidos: filas.length };
}

// Qué tarjetas pintar con el corazón lleno. Devuelve llaves "slug:color".
export async function listarFavoritos(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("favoritos")
    .select("color, products(slug)")
    .eq("customer_id", user.id);
  return (data ?? []).map((f) => `${(f.products as { slug: string } | null)?.slug}:${f.color ?? ""}`);
}
