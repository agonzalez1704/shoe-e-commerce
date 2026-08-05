import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { InventoryColorway, type Colorway } from "@/components/admin/InventoryColorway";
import { requirePagePermiso } from "@/lib/permisos-guard";

export const dynamic = "force-dynamic";

const PER_PAGE = 12; // colourways per page — each one carries all its sizes
const STOCK = [
  { key: "all", label: "Todo" },
  { key: "agotado", label: "Con tallas agotadas" },
  { key: "bajo", label: "Stock bajo" },
  { key: "con", label: "Con existencia" },
] as const;

type SearchParams = Promise<{
  q?: string; modelo?: string; talla?: string; stock?: string; page?: string;
}>;

export default async function AdminInventory({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermiso("inventario_ver");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().replace(/[,()%*\\]/g, "").slice(0, 60);
  const modelo = sp.modelo ?? "";
  const talla = sp.talla ?? "";
  const stock = sp.stock ?? "all";
  const current = Math.max(1, Number(sp.page) || 1);
  const from = (current - 1) * PER_PAGE;

  const supabase = await createClient();

  // 1) page over colourways (33 today, not 363 rows)
  let cw = supabase
    .from("admin_inventory_colorways")
    .select("product_id, product_name, color, made_to_order, on_hand, agotadas, min_available", { count: "exact" })
    .order("product_name")
    .order("color")
    .range(from, from + PER_PAGE - 1);

  if (modelo) cw = cw.eq("product_id", modelo);
  if (stock === "agotado") cw = cw.gt("agotadas", 0);
  if (stock === "bajo") cw = cw.gt("min_available", 0).lte("min_available", 3);
  if (stock === "con") cw = cw.gt("on_hand", 0);
  if (q) cw = cw.or(`product_name.ilike.%${q}%,color.ilike.%${q}%`);

  const [{ data: colorways, count }, { data: productos }, { data: tallasAll }] = await Promise.all([
    cw,
    supabase.from("products").select("id, name").order("name"),
    supabase.from("admin_inventory").select("size_value"),
  ]);

  // 2) the sizes, only for the colourways actually on this page
  let sizes: {
    variant_id: string | null; product_id: string | null; color: string | null;
    size_value: string | null; size_system: string | null; on_hand: number | null; reserved: number | null;
  }[] = [];
  if (colorways?.length) {
    const ids = [...new Set(colorways.map((c) => c.product_id).filter(Boolean))] as string[];
    let sq = supabase
      .from("admin_inventory")
      .select("variant_id, product_id, color, size_value, size_system, on_hand, reserved")
      .in("product_id", ids);
    if (talla) sq = sq.eq("size_value", talla);
    const { data } = await sq;
    sizes = data ?? [];
  }

  const groups: Colorway[] = (colorways ?? []).map((c) => ({
    productId: c.product_id as string,
    productName: c.product_name ?? "—",
    color: c.color ?? "—",
    madeToOrder: c.made_to_order ?? false,
    onHand: c.on_hand ?? 0,
    agotadas: c.agotadas ?? 0,
    sizes: sizes
      .filter((s) => `${s.product_id}|${s.color}` === `${c.product_id}|${c.color}`)
      .sort((a, b) => parseFloat(a.size_value ?? "0") - parseFloat(b.size_value ?? "0"))
      .map((s) => ({
        variantId: s.variant_id as string,
        size: s.size_value ?? "",
        sizeSystem: s.size_system ?? "MX",
        onHand: s.on_hand ?? 0,
        reserved: s.reserved ?? 0,
      })),
  })).filter((g) => g.sizes.length > 0); // a size filter can empty a colourway

  const sizeOptions = [...new Set((tallasAll ?? []).map((t) => t.size_value).filter((s): s is string => !!s))]
    .sort((a, b) => parseFloat(a) - parseFloat(b));

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const hrefFor = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const m = { q, modelo, talla, stock, page: current, ...over };
    if (m.q) p.set("q", String(m.q));
    if (m.modelo) p.set("modelo", String(m.modelo));
    if (m.talla) p.set("talla", String(m.talla));
    if (m.stock && m.stock !== "all") p.set("stock", String(m.stock));
    if (m.page && Number(m.page) > 1) p.set("page", String(m.page));
    const s = p.toString();
    return `/admin/inventory${s ? `?${s}` : ""}`;
  };

  const SEL = "h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Inventario</h1>
        <span className="text-sm text-muted">
          <span className="nums font-medium text-text">{total}</span> modelo{total === 1 ? "" : "s"} en color
          {talla && <> · solo talla {talla}</>}
        </span>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Modelo o color…"
            className="w-52 rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
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

      <div className="space-y-3">
        {groups.map((g) => <InventoryColorway key={`${g.productId}|${g.color}`} group={g} />)}
        {groups.length === 0 && (
          <p className="rounded-2xl border border-border p-10 text-center text-sm text-muted">
            Ningún modelo coincide con esos filtros.
          </p>
        )}
      </div>

      {total > PER_PAGE && (
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
