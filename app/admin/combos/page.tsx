import { createClient } from "@/lib/supabase/server";
import { requirePagePermiso } from "@/lib/permisos-guard";
import { CombosView, type ParCombo } from "@/components/admin/CombosView";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;

export default async function AdminCombos() {
  await requirePagePermiso("promociones_gestionar");
  const supabase = await createClient();

  const ahora = new Date().toISOString();
  const [{ data: prods }, { data: promos }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, base_price_cents, combo_group, combo_min_qty, combo_price_cents, combo_price_mixto_cents, combo_price_exotico_cents, variants(color, status, fuera_de_combo, exotico)")
      .eq("status", "active")
      .order("name"),
    // Un par con promocion vigente no es elegible para combo (create_order los
    // hace excluyentes); el tablero lo marca en vez de dejar armar algo que la
    // caja no cobraria.
    supabase
      .from("promociones")
      .select("promocion_productos(product_id, colores)")
      .eq("active", true)
      .lte("starts_at", ahora)
      .gte("ends_at", ahora),
  ]);

  const enPromo = new Set(
    // solo promos de modelo completo bloquean; una de algunos colores no
    (promos ?? []).flatMap((p) => (p.promocion_productos ?? []).filter((x) => !x.colores).map((x) => x.product_id)),
  );

  const pares: ParCombo[] = (prods ?? []).map(({ variants, ...p }) => {
    // un color esta dentro si alguna de sus tallas activas lo esta
    const porColor = new Map<string, { dentro: boolean; exotico: boolean }>();
    for (const v of variants ?? []) {
      if (v.status !== "active" || !v.color) continue;
      const c = porColor.get(v.color) ?? { dentro: false, exotico: false };
      porColor.set(v.color, { dentro: c.dentro || !v.fuera_de_combo, exotico: c.exotico || v.exotico });
    }
    return { ...p, promo: enPromo.has(p.id), colores: [...porColor].map(([color, c]) => ({ color, ...c })) };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Combos</h1>
        <p className="mt-1 text-sm text-muted">
          Decide qué pares entran al combo. La oferta aplica combinando los modelos y colores que dejes dentro.
        </p>
      </div>
      <CombosView pares={pares} />
    </div>
  );
}
