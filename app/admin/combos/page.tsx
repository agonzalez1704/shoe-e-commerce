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
      .select("id, name, base_price_cents, combo_group, combo_min_qty, combo_price_cents")
      .eq("status", "active")
      .order("name"),
    // Un par con promocion vigente no es elegible para combo (create_order los
    // hace excluyentes); el tablero lo marca en vez de dejar armar algo que la
    // caja no cobraria.
    supabase
      .from("promociones")
      .select("promocion_productos(product_id)")
      .eq("active", true)
      .lte("starts_at", ahora)
      .gte("ends_at", ahora),
  ]);

  const enPromo = new Set(
    (promos ?? []).flatMap((p) => (p.promocion_productos ?? []).map((x) => x.product_id)),
  );

  const pares: ParCombo[] = (prods ?? []).map((p) => ({ ...p, promo: enPromo.has(p.id) }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Combos</h1>
        <p className="mt-1 text-sm text-muted">
          Decide qué pares entran al combo. La oferta aplica combinando cualquier modelo del grupo.
        </p>
      </div>
      <CombosView pares={pares} />
    </div>
  );
}
