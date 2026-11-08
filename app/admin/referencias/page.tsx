import { createClient } from "@/lib/supabase/server";
import { requirePagePermiso } from "@/lib/permisos-guard";
import { ReferenciaForm, type ModeloRef } from "@/components/admin/ReferenciaForm";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;

export default async function AdminReferencias() {
  await requirePagePermiso("pedidos_gestionar");
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, variants(id, color, size_value, width, status)")
    .eq("status", "active")
    .order("name");

  const modelos: ModeloRef[] = (data ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      variantes: (p.variants ?? [])
        .flatMap(({ id, color, size_value, width, status }) =>
          status === "active" && size_value ? [{ id, color, talla: size_value, ancho: width ?? "medium" }] : [],
        )
        .sort((a, b) => Number(a.talla) - Number(b.talla)),
    }))
    .filter((m) => m.variantes.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Referencias de pago</h1>
        <p className="mt-1 text-sm text-muted">
          Genera una ficha para pagar en efectivo en tienda. Crea el pedido, aparta el inventario 3 días y aplica combo y promociones vigentes.
        </p>
      </div>
      <ReferenciaForm modelos={modelos} />
    </div>
  );
}
