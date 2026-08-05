import { createClient } from "@/lib/supabase/server";
import {
  PromocionesView,
  type PromoRow,
  type ProductoOpcion,
} from "@/components/admin/PromocionesView";
import { requirePagePermiso } from "@/lib/permisos-guard";

export const dynamic = "force-dynamic";

export default async function AdminPromociones() {
  await requirePagePermiso("promociones_gestionar");
  const supabase = await createClient();

  const [{ data: promosData }, { data: prodData }] = await Promise.all([
    supabase
      .from("promociones")
      .select("id, nombre, percent, starts_at, ends_at, active, promocion_productos(product_id)")
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, name, base_price_cents")
      .eq("status", "active")
      .is("combo_group", null) // combos can't be discounted
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
      promocion_productos: { product_id: string }[];
    }[]
  ).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    percent: p.percent,
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    active: p.active,
    productIds: (p.promocion_productos ?? []).map((x) => x.product_id),
  }));

  const productos = ((prodData ?? []) as unknown as ProductoOpcion[]).map((p) => ({
    id: p.id,
    name: p.name,
    base_price_cents: p.base_price_cents,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Promociones</h1>
        <span className="text-sm text-muted">{promos.length} promociones</span>
      </div>
      <p className="text-sm text-muted">
        Descuento por % en los pares seleccionados durante un periodo. No aplica a combos.
      </p>
      <PromocionesView promos={promos} productos={productos} />
    </div>
  );
}
