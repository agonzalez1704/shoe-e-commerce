"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { alternarCombo, configurarCombo } from "@/app/admin/combo-actions";

// Aplica una propuesta de combo confirmada por el administrador en el chat.
// Resuelve nombres a productos y delega en las acciones del armador — que
// cargan su propio requirePermiso("promociones_gestionar") y sus reglas (un
// par en promocion no entra, config copiada del grupo). El chat no puede
// saltarse nada porque este es el mismo camino que el armador.

export type PropuestaCombo = {
  acciones: { tipo: "meter" | "sacar"; producto: string }[];
  config?: { pares?: number; precioMxn?: number };
};

export async function aplicarCambioCombo(p: PropuestaCombo): Promise<{ ok: boolean; detalle: string[] }> {
  const admin = createAdminClient();
  const { data: prods } = await admin
    .from("products").select("id, name, combo_group").eq("status", "active");
  const grupo = (prods ?? []).find((x) => x.combo_group)?.combo_group ?? null;
  const detalle: string[] = [];

  try {
    for (const a of p.acciones ?? []) {
      const prod = (prods ?? []).find((x) => x.name.toLowerCase() === a.producto.toLowerCase().trim())
        ?? (prods ?? []).find((x) => x.name.toLowerCase().includes(a.producto.toLowerCase().trim()));
      if (!prod) { detalle.push(`No encontré el modelo "${a.producto}"`); continue; }
      if (a.tipo === "meter") {
        if (!grupo) { detalle.push("No hay un combo activo al cual meter modelos"); continue; }
        if (prod.combo_group) { detalle.push(`${prod.name} ya estaba en el combo`); continue; }
        await alternarCombo(prod.id, grupo);
        detalle.push(`${prod.name} entró al combo`);
      } else {
        if (!prod.combo_group) { detalle.push(`${prod.name} no estaba en el combo`); continue; }
        await alternarCombo(prod.id, null);
        detalle.push(`${prod.name} salió del combo`);
      }
    }
    if (p.config && grupo && (p.config.pares || p.config.precioMxn)) {
      const actual = (prods ?? []).find((x) => x.combo_group === grupo);
      const { data: cfgRow } = await admin.from("products")
        .select("combo_min_qty, combo_price_cents").eq("id", actual?.id ?? "").maybeSingle();
      const pares = p.config.pares ?? cfgRow?.combo_min_qty ?? 2;
      const precio = p.config.precioMxn != null ? Math.round(p.config.precioMxn * 100) : cfgRow?.combo_price_cents ?? 0;
      await configurarCombo(grupo, pares, precio);
      detalle.push(`Oferta del combo: ${pares} pares por $${(precio / 100).toLocaleString("es-MX")}`);
    }
    return { ok: true, detalle };
  } catch (e) {
    detalle.push(e instanceof Error ? e.message : "Error al aplicar");
    return { ok: false, detalle };
  }
}
