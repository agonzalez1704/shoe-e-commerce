"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requirePermiso } from "@/lib/permisos-guard";

// Armador de combos. La membresia vive en products.combo_group (+ combo_min_qty
// y combo_price_cents): los productos que comparten grupo forman el pool y cada
// minQty pares del pool cuestan priceCents (el RPC create_order es la verdad de
// cobro). Aqui solo se decide quien entra, quien sale y la config del grupo.

async function db() {
  return await requirePermiso("promociones_gestionar");
}

function refresca() {
  revalidatePath("/admin/combos");
  updateTag("productos");
  updateTag("stock");
  updateTag("promos");
}

// Mete o saca un par del combo. Al entrar, la config se copia del grupo en el
// servidor (no se confia en la del navegador); al salir se limpian las tres
// columnas y el par vuelve a ser elegible para promociones.
export async function alternarCombo(productId: string, grupo: string | null): Promise<void> {
  const supabase = await db();

  if (grupo === null) {
    const { error } = await supabase
      .from("products")
      .update({ combo_group: null, combo_min_qty: null, combo_price_cents: null })
      .eq("id", productId);
    if (error) throw new Error(error.message);
    refresca();
    return;
  }

  const { data: miembro } = await supabase
    .from("products")
    .select("combo_min_qty, combo_price_cents")
    .eq("combo_group", grupo)
    .not("combo_min_qty", "is", null)
    .limit(1)
    .maybeSingle();
  if (!miembro) throw new Error(`El combo "${grupo}" no existe o quedo sin miembros.`);

  const { error } = await supabase
    .from("products")
    .update({
      combo_group: grupo,
      combo_min_qty: miembro.combo_min_qty,
      combo_price_cents: miembro.combo_price_cents,
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  refresca();
}

// Cambia la oferta del grupo (p. ej. 2x$1,999 -> 2x$2,099) para TODOS sus
// miembros de un golpe: la config vive repetida por fila y desincronizarla
// romperia el pool.
export async function configurarCombo(grupo: string, minQty: number, priceCents: number): Promise<void> {
  const supabase = await db();
  if (!(minQty >= 2)) throw new Error("El combo necesita al menos 2 pares.");
  if (!(priceCents > 0)) throw new Error("El precio del combo debe ser mayor a 0.");

  const { error } = await supabase
    .from("products")
    .update({ combo_min_qty: Math.round(minQty), combo_price_cents: Math.round(priceCents) })
    .eq("combo_group", grupo);
  if (error) throw new Error(error.message);
  refresca();
}

// Un combo nuevo: nombre de grupo + oferta + sus primeros miembros.
export async function crearCombo(grupo: string, minQty: number, priceCents: number, productIds: string[]): Promise<void> {
  const supabase = await db();
  const g = grupo.trim().toLowerCase().replace(/\s+/g, "-");
  if (!g) throw new Error("Ponle nombre al combo.");
  if (!(minQty >= 2)) throw new Error("El combo necesita al menos 2 pares.");
  if (!(priceCents > 0)) throw new Error("El precio del combo debe ser mayor a 0.");
  const ids = [...new Set(productIds)];
  if (ids.length < minQty) throw new Error(`Selecciona al menos ${minQty} pares (el minimo del combo).`);

  const { data: existente } = await supabase
    .from("products").select("id").eq("combo_group", g).limit(1).maybeSingle();
  if (existente) throw new Error(`Ya existe un combo llamado "${g}".`);

  const { error } = await supabase
    .from("products")
    .update({ combo_group: g, combo_min_qty: Math.round(minQty), combo_price_cents: Math.round(priceCents) })
    .in("id", ids);
  if (error) throw new Error(error.message);
  refresca();
}
