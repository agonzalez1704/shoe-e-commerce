import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { InventoryRow, type InvRow } from "@/components/InventoryRow";
import { requirePagePermiso } from "@/lib/permisos-guard";

export const dynamic = "force-dynamic";

const PER_PAGE = 40;
const STOCK = [
  { key: "all", label: "Todo" },
  { key: "agotado", label: "Agotado" },
  { key: "bajo", label: "Stock bajo" },
  { key: "con", label: "Con existencia" },
] as const;

type SearchParams = Promise<{
  q?: string; modelo?: string; talla?: string; stock?: string; page?: string;
}>;

export default async function AdminInventory({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermiso("inventario_ver");
  const sp = await searchParams;
  // strip what would break the PostgREST .or() syntax
  const q = (sp.q ?? "").trim().replace(/[,()%*\\]/g, "").slice(0, 60);
  const modelo = sp.modelo ?? "";
  const talla = sp.talla ?? "";
  const stock = sp.stock ?? "all";
  const current = Math.max(1, Number(sp.page) || 1);
  const from = (current - 1) * PER_PAGE;

  const supabase = await createClient();

  // options for the dropdowns (whole catalog, not just this page)
  const [{ data: productos }, { data: tallas }] = await Promise.all([
    supabase.from("products").select("id, name").order("name"),
    supabase.from("admin_inventory").select("size_value").order("size_value"),
  ]);
  // view columns come back nullable — drop the empties before sorting numerically
  const sizeOptions = [...new Set((tallas ?? []).map((t) => t.size_value).filter((s): s is string => !!s))]
    .sort((a, b) => parseFloat(a) - parseFloat(b));

  let sb = supabase
    .from("admin_inventory")
    .select("variant_id, sku, size_value, size_system, width, color, product_name, made_to_order, on_hand, reserved, available",
      { count: "exact" })
    .order("available", { ascending: true })   // low stock first, now done in the DB
    .order("sku", { ascending: true })
    .range(from, from + PER_PAGE - 1);

  if (modelo) sb = sb.eq("product_id", modelo);
  if (talla) sb = sb.eq("size_value", talla);
  if (stock === "agotado") sb = sb.eq("available", 0);
  if (stock === "bajo") sb = sb.gt("available", 0).lte("available", 3);
  if (stock === "con") sb = sb.gt("available", 0);
  if (q) sb = sb.or(`sku.ilike.%${q}%,color.ilike.%${q}%,product_name.ilike.%${q}%`);

  const { data, count } = await sb;

  const rows: InvRow[] = (data ?? []).map((v) => ({
    variantId: v.variant_id as string,
    productName: v.product_name ?? "—",
    label: `${v.size_system} ${v.size_value} / ${v.width} / ${v.color}`,
    sku: v.sku as string,
    onHand: v.on_hand ?? 0,
    reserved: v.reserved ?? 0,
    madeToOrder: v.made_to_order ?? false,
  }));

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const hrefFor = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, modelo, talla, stock, page: current, ...over };
    if (merged.q) p.set("q", String(merged.q));
    if (merged.modelo) p.set("modelo", String(merged.modelo));
    if (merged.talla) p.set("talla", String(merged.talla));
    if (merged.stock && merged.stock !== "all") p.set("stock", String(merged.stock));
    if (merged.page && Number(merged.page) > 1) p.set("page", String(merged.page));
    const s = p.toString();
    return `/admin/inventory${s ? `?${s}` : ""}`;
  };

  const SEL = "h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Inventario</h1>
        <span className="text-sm text-muted">
          <span className="nums font-medium text-text">{total}</span> variante{total === 1 ? "" : "s"} · stock bajo primero
        </span>
      </div>

      {/* filtros: un solo form, GET, para que la URL quede compartible */}
      <form className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="SKU, modelo o color…"
            className="w-56 rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <select name="modelo" defaultValue={modelo} className={SEL}>
          <option value="">Todos los modelos</option>
          {(productos ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="talla" defaultValue={talla} className={SEL}>
          <option value="">Todas las tallas</option>
          {sizeOptions.map((s) => <option key={s} value={s}>MX {s}</option>)}
        </select>
        <select name="stock" defaultValue={stock} className={SEL}>
          {STOCK.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast">Filtrar</button>
        {(q || modelo || talla || stock !== "all") && (
          <Link href="/admin/inventory" className="text-sm text-muted transition-colors hover:text-text">Limpiar</Link>
        )}
      </form>

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
            {rows.map((r) => <InventoryRow key={r.variantId} row={r} />)}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted">Ninguna variante coincide.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            {from + 1}–{Math.min(from + PER_PAGE, total)} de <span className="nums font-medium text-text">{total}</span>
          </p>
          <div className="flex items-center gap-2">
            {current > 1 ? (
              <Link href={hrefFor({ page: current - 1 })} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-text">← Anterior</Link>
            ) : (
              <span className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted/40">← Anterior</span>
            )}
            <span className="text-xs text-muted">Página {current} de {lastPage}</span>
            {current < lastPage ? (
              <Link href={hrefFor({ page: current + 1 })} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-text">Siguiente →</Link>
            ) : (
              <span className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted/40">Siguiente →</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
