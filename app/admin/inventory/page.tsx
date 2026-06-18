import { createClient } from "@/lib/supabase/server";
import { InventoryRow, type InvRow } from "@/components/InventoryRow";

export const dynamic = "force-dynamic";

export default async function AdminInventory() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("variants")
    .select("id, sku, size_value, size_system, width, color, products(name), inventory(qty_on_hand, qty_reserved)")
    .order("sku");

  type Raw = {
    id: string; sku: string; size_value: string; size_system: string; width: string; color: string;
    products: { name: string } | null;
    inventory: { qty_on_hand: number; qty_reserved: number } | null;
  };
  const rows: InvRow[] = ((data ?? []) as unknown as Raw[]).map((v) => ({
    variantId: v.id,
    productName: v.products?.name ?? "—",
    label: `${v.size_system} ${v.size_value} / ${v.width} / ${v.color}`,
    sku: v.sku,
    onHand: v.inventory?.qty_on_hand ?? 0,
    reserved: v.inventory?.qty_reserved ?? 0,
  }));

  rows.sort((a, b) => a.onHand - a.reserved - (b.onHand - b.reserved)); // low stock first

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Inventario</h1>
        <span className="text-sm text-muted">{rows.length} variantes · stock bajo primero</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Variante</th>
              <th className="px-4 py-3 text-right">Reservado</th>
              <th className="px-4 py-3 text-right">Disponible</th>
              <th className="px-4 py-3 text-right">En existencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <InventoryRow key={r.variantId} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
