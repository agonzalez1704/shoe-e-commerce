import { createClient } from "@/lib/supabase/server";
import {
  PromocionesView,
  type PromoRow,
  type ProductoOpcion,
} from "@/components/admin/PromocionesView";
import { requirePagePermiso } from "@/lib/permisos-guard";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;


export default async function AdminPromociones() {
  await requirePagePermiso("promociones_gestionar");
  const supabase = await createClient();

  const [{ data: promosData }, { data: prodData }] = await Promise.all([
    supabase
      .from("promociones")
      .select("id, nombre, percent, starts_at, ends_at, active, promocion_productos(product_id, colores)")
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, name, base_price_cents, variants(color, status)")
      .eq("status", "active")
      .order("name"),
  ]);

  const promos: PromoRow[] = (
    (promosData ?? []) as unknown as {
      id: string;
      nombre: string;
      percent: number;
      starts_at: string;
      ends_at: string;
      active: boolean;
      promocion_productos: { product_id: string; colores: string[] | null }[];
    }[]
  ).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    percent: p.percent,
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    active: p.active,
    items: (p.promocion_productos ?? []).map((x) => ({ productId: x.product_id, colores: x.colores })),
  }));

  type Prod = { id: string; name: string; base_price_cents: number; variants: { color: string | null; status: string }[] };
  const productos: ProductoOpcion[] = ((prodData ?? []) as unknown as Prod[]).map((p) => ({
    id: p.id,
    name: p.name,
    base_price_cents: p.base_price_cents,
    colores: [...new Set(p.variants.filter((v) => v.status === "active" && v.color).map((v) => v.color!))],
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Promociones</h1>
        <span className="text-sm text-muted">{promos.length} promociones</span>
      </div>
      <p className="text-sm text-muted">
        Descuento por % en los pares (o solo algunos colores) durante un periodo. Si el par también entra a un combo, se cobra el mejor precio.
      </p>
      <PromocionesView promos={promos} productos={productos} />
    </div>
  );
}
