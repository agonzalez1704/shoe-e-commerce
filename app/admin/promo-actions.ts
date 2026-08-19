"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermiso } from "@/lib/permisos-guard";

async function db() {
  return await requirePermiso("promociones_gestionar");
}

export type PromoInput = {
  nombre: string;
  percent: number;
  startsAt: string; // datetime-local
  endsAt: string;
  productIds: string[];
};

export async function crearPromocion(input: PromoInput): Promise<void> {
  const supabase = await db();

  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre es obligatorio");
  const percent = Math.round(input.percent);
  if (!(percent >= 1 && percent <= 99)) throw new Error("El porcentaje debe ser entre 1 y 99");
  const starts = new Date(input.startsAt);
  const ends = new Date(input.endsAt);
  if (isNaN(+starts) || isNaN(+ends) || ends <= starts) throw new Error("Rango de fechas inválido");
  const ids = [...new Set(input.productIds)];
  if (ids.length === 0) throw new Error("Selecciona al menos un par");

  const { data: promo, error } = await supabase
    .from("promociones")
    .insert({ nombre, percent, starts_at: starts.toISOString(), ends_at: ends.toISOString() })
    .select("id")
    .single();
  if (error || !promo) throw new Error(error?.message ?? "No se pudo crear la promoción");

  const rows = ids.map((product_id) => ({ promocion_id: promo.id, product_id }));
  const { error: e2 } = await supabase.from("promocion_productos").insert(rows);
  if (e2) throw new Error(e2.message ?? "No se pudieron asignar los productos");

  revalidatePath("/admin/promociones");
  updateTag("promos");
}

// End a promo now — an admin can stop it at any moment.
export async function finalizarPromocion(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("promociones").update({ active: false }).eq("id", id);
  if (error) throw new Error(error.message ?? "No se pudo finalizar");
  revalidatePath("/admin/promociones");
  updateTag("promos");
}

// Re-activate a stopped promo (only meaningful while still within its window).
export async function reactivarPromocion(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("promociones").update({ active: true }).eq("id", id);
  if (error) throw new Error(error.message ?? "No se pudo reactivar");
  revalidatePath("/admin/promociones");
  updateTag("promos");
}

export async function eliminarPromocion(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("promociones").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "No se pudo eliminar");
  revalidatePath("/admin/promociones");
  updateTag("promos");
}
