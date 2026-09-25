import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { getPromoMap } from "@/lib/catalog";
import { promoDe } from "@/lib/pricing";
import { ProductStatusToggle } from "@/components/ProductStatusToggle";
import { requirePagePermiso } from "@/lib/permisos-guard";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;


const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

type Row = {
  id: string; name: string; slug: string; status: "draft" | "active" | "archived";
  base_price_cents: number; made_to_order: boolean; combo_group: string | null;
  brands: { name: string } | null;
  product_images: { url: string; color: string | null; position: number }[];
  variants: { id: string; color: string; status: string; fuera_de_combo: boolean; exotico: boolean; inventory: { qty_on_hand: number } | null }[];
};

const FILTROS = [
  ["", "Todos"],
  ["activos", "Activos"],
  ["combo", "En combo"],
  ["promo", "Con promoción"],
  ["exoticos", "Exóticos"],
  ["borradores", "Borradores"],
] as const;

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string }>;
}) {
  await requirePagePermiso("productos_gestionar");
  const sp = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select(
      "id, name, slug, status, base_price_cents, made_to_order, combo_group, brands(name), " +
        "product_images(url, color, position), " +
        "variants(id, color, status, fuera_de_combo, exotico, inventory(qty_on_hand))",
    )
    .order("created_at", { ascending: false });

  const promoMap = await getPromoMap();
  const todos = (data ?? []) as unknown as Row[];

  // Una ficha por color: foto, si entra al combo y su promo. Es lo que el
  // listado viejo no decia — solo daba el numero de variantes.
  const filas = todos.map((p) => {
    const activas = p.variants.filter((v) => v.status === "active");
    const promos = promoMap.get(p.id);
    const colores = [...new Set(activas.map((v) => v.color))].map((color) => {
      const suyas = activas.filter((v) => v.color === color);
      return {
        color,
        foto: p.product_images.find((i) => i.color === color)?.url ?? null,
        tallas: suyas.length,
        enCombo: !!p.combo_group && suyas.some((v) => !v.fuera_de_combo),
        exotico: suyas.some((v) => v.exotico),
        promo: promoDe(promos, color),
      };
    });
    const stock = activas.reduce((s, v) => s + (v.inventory?.qty_on_hand ?? 0), 0);
    const enCombo = colores.filter((c) => c.enCombo).length;
    const conPromo = colores.filter((c) => c.promo).length;
    return {
      ...p,
      portada: [...p.product_images].sort((a, b) => a.position - b.position)[0]?.url ?? null,
      colores,
      variantes: activas.length,
      stock,
      enCombo,
      conPromo,
      pctMax: Math.max(0, ...colores.map((c) => c.promo ?? 0)),
    };
  });

  const q = (sp.q ?? "").trim().toLowerCase();
  const f = sp.f ?? "";
  const productos = filas.filter((p) => {
    if (q && !(`${p.name} ${p.slug} ${p.colores.map((c) => c.color).join(" ")}`.toLowerCase().includes(q))) return false;
    if (f === "activos") return p.status === "active";
    if (f === "borradores") return p.status !== "active";
    if (f === "combo") return p.enCombo > 0;
    if (f === "promo") return p.conPromo > 0;
    if (f === "exoticos") return p.colores.some((c) => c.exotico);
    return true;
  });

  const totalColores = productos.reduce((s, p) => s + p.colores.length, 0);
  const href = (params: { q?: string; f?: string }) => {
    const u = new URLSearchParams();
    if (params.q) u.set("q", params.q);
    if (params.f) u.set("f", params.f);
    const s = u.toString();
    return s ? `/admin/products?${s}` : "/admin/products";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Productos</h1>
        <span className="nums rounded-full border border-border bg-elevated px-2.5 py-0.5 text-xs text-muted">
          {productos.length} modelos · {totalColores} colores
        </span>
        <div className="flex-1" />
        <Link href="/admin/products/new" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast">
          Nuevo producto
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form className="contents">
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Buscar por modelo, color o slug"
            className="w-72 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text"
          />
          {f && <input type="hidden" name="f" value={f} />}
        </form>
        {FILTROS.map(([id, label]) => (
          <Link
            key={id || "todos"}
            href={href({ q: sp.q, f: id })}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              f === id ? "bg-text font-medium text-bg" : "border border-border text-muted hover:text-text"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="divide-y divide-border rounded-2xl border border-border">
        <div className="hidden bg-elevated px-4 py-2.5 text-xs uppercase tracking-wide text-muted md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_120px_120px_120px] md:gap-4">
          <span>Modelo</span>
          <span>Colores</span>
          <span>Tallas y stock</span>
          <span>Precio</span>
          <span>Estado</span>
        </div>

        {productos.map((p) => (
          <div key={p.id} className="grid gap-3 px-4 py-3 transition-colors hover:bg-elevated/50 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_120px_120px_120px] md:items-center md:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Foto url={p.portada} alt={p.name} className="h-14 w-14 rounded-xl" />
              <span className="min-w-0">
                <Link href={`/admin/products/${p.id}/edit`} className="block truncate text-sm font-medium hover:text-accent">
                  {p.name}
                </Link>
                <span className="nums block truncate text-xs text-muted">/{p.slug}</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {p.colores.map((c) => (
                <Link
                  key={c.color}
                  href={`/admin/products/${p.id}/edit`}
                  title={`${c.color} · ${c.tallas} tallas · piel ${c.exotico ? "exótica" : "clásica"}${c.enCombo ? " · en combo" : ""}${c.promo ? ` · -${c.promo}%` : ""}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-2.5 text-xs capitalize text-muted transition-colors hover:border-text hover:text-text"
                >
                  <Foto url={c.foto} alt={`${p.name} ${c.color}`} className="h-8 w-8 rounded-full" />
                  {c.color}
                  {c.exotico && <span className="rounded-full bg-text px-1.5 text-[9px] font-semibold uppercase leading-4 tracking-wide text-bg">exótico</span>}
                </Link>
              ))}
              {p.colores.length === 0 && <span className="text-xs text-muted">Sin variantes</span>}
            </div>

            <div className="text-sm">
              <span className="nums">{p.variantes} variantes</span>
              <span className="block text-xs text-muted">{p.made_to_order ? "Sobre pedido" : `${p.stock} en stock`}</span>
            </div>

            <div className="text-sm">
              <span className="nums">{mxn(p.base_price_cents)}</span>
              {p.pctMax > 0 && (
                <span className="nums block text-xs text-accent">
                  -{p.pctMax}% · {mxn(Math.round((p.base_price_cents * (100 - p.pctMax)) / 100))}
                </span>
              )}
              <span className="block text-xs text-muted">
                {p.enCombo === 0
                  ? "Fuera del combo"
                  : p.enCombo === p.colores.length
                    ? "En combo"
                    : `Combo: ${p.enCombo} de ${p.colores.length}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ProductStatusToggle productId={p.id} status={p.status} />
            </div>
          </div>
        ))}

        {productos.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">Ningún producto coincide.</p>
        )}
      </div>
    </div>
  );
}

// Los modelos se parecen entre si: la miniatura sola no basta para saber cual
// es cual, asi que al pasar el cursor se abre la foto en grande.
function Foto({ url, alt, className }: { url: string | null; alt: string; className: string }) {
  if (!url) return <span className={`${className} shrink-0 border border-border bg-elevated`} />;
  return (
    <span className="group/foto relative shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className={`${className} border border-border bg-elevated object-cover`} />
      <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-md)] group-hover/foto:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
        <span className="mt-1 block truncate text-center text-xs capitalize text-muted">{alt}</span>
      </span>
    </span>
  );
}
