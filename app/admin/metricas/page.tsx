import Link from "next/link";
import { Eye, Users, CursorClick } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { requirePagePermiso } from "@/lib/permisos-guard";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;


type Bucket = { n: number } & Record<string, string | number>;
type Summary = {
  pageviews: number;
  sessions: number;
  clicks_total: number;
  top_pages: (Bucket & { path: string })[];
  sources: (Bucket & { source: string })[];
  clicks: (Bucket & { target: string })[];
  devices: (Bucket & { device: string })[];
  daily: { day: string; n: number }[];
};

const RANGES = [
  { days: 1, label: "Hoy" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
];

export default async function MetricasPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requirePagePermiso("metricas_ver");
  const { d } = await searchParams;
  const days = RANGES.some((r) => String(r.days) === d) ? Number(d) : 7;

  const supabase = await createClient();
  const desde = new Date(Date.now() - days * 864e5).toISOString();
  const [{ data }, { data: vendidos }, { data: vistasPdp }, { data: slugs }] = await Promise.all([
    supabase.rpc("analytics_summary", { p_days: days }),
    // lineas de pedidos cobrados del rango — de aqui salen todos los cortes de producto
    supabase
      .from("order_items")
      .select("product_name, quantity, line_total_cents, variant_label, orders!inner(status, created_at)")
      .in("orders.status", ["paid", "fulfilled"])
      .gte("orders.created_at", desde),
    // vistas de PDP del rango, para la conversion vista -> compra por modelo
    supabase
      .from("analytics_events")
      .select("path")
      .eq("type", "pageview")
      .like("path", "/products/%")
      .gte("created_at", desde)
      .limit(20000),
    supabase.from("products").select("name, slug"),
  ]);
  const s = (data ?? {}) as Partial<Summary>;

  // cortes de producto
  type Linea = { product_name: string; quantity: number; line_total_cents: number; variant_label: string };
  const lineas = (vendidos ?? []) as unknown as Linea[];
  const porProducto = new Map<string, { pares: number; ingresos: number }>();
  const porTalla = new Map<string, number>();
  const porColor = new Map<string, number>();
  let paresTotal = 0, ingresosTotal = 0;
  for (const l of lineas) {
    const nombre = l.product_name.replace(" (completa tu combo)", "");
    const e = porProducto.get(nombre) ?? { pares: 0, ingresos: 0 };
    e.pares += l.quantity; e.ingresos += l.line_total_cents;
    porProducto.set(nombre, e);
    paresTotal += l.quantity; ingresosTotal += l.line_total_cents;
    // variant_label: "MX 27 / medium / negro" — talla al frente, color al final
    const partes = l.variant_label.split("/").map((x) => x.trim());
    if (partes[0]) porTalla.set(partes[0], (porTalla.get(partes[0]) ?? 0) + l.quantity);
    const color = partes.slice(2).join("/");
    if (color) porColor.set(color, (porColor.get(color) ?? 0) + l.quantity);
  }
  const topVendidos = [...porProducto.entries()].sort((a, b) => b[1].pares - a[1].pares);
  const topIngresos = [...porProducto.entries()].sort((a, b) => b[1].ingresos - a[1].ingresos);
  const topTallas = [...porTalla.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topColores = [...porColor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // vistas por slug -> conversion por modelo (pares vendidos / vistas de su PDP)
  const nombrePorSlug = new Map((slugs ?? []).map((x) => [x.slug, x.name]));
  const vistasPorNombre = new Map<string, number>();
  for (const v of (vistasPdp ?? []) as { path: string }[]) {
    const slug = decodeURIComponent(v.path.split("/")[2] ?? "").split("?")[0];
    const nombre = nombrePorSlug.get(slug);
    if (nombre) vistasPorNombre.set(nombre, (vistasPorNombre.get(nombre) ?? 0) + 1);
  }
  const conversion = [...vistasPorNombre.entries()]
    .map(([nombre, vistas]) => ({ nombre, vistas, pares: porProducto.get(nombre)?.pares ?? 0 }))
    .filter((x) => x.vistas >= 5)
    .map((x) => ({ ...x, tasa: x.pares / x.vistas }))
    .sort((a, b) => b.tasa - a.tasa);
  const mxn0 = (c: number) => `$${Math.round(c / 100).toLocaleString("es-MX")}`;

  const maxDaily = Math.max(1, ...(s.daily ?? []).map((x) => x.n));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Métricas</h1>
        <div className="flex gap-1 rounded-full border border-border p-1">
          {RANGES.map((r) => (
            <Link
              key={r.days}
              href={`/admin/metricas?d=${r.days}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                days === r.days ? "bg-text text-bg" : "text-muted hover:text-text"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi icon={<Eye size={18} className="text-accent" />} label="Visitas (pageviews)" value={s.pageviews ?? 0} />
        <Kpi icon={<Users size={18} className="text-accent" />} label="Sesiones (personas)" value={s.sessions ?? 0} />
        <Kpi icon={<CursorClick size={18} className="text-accent" />} label="Clicks" value={s.clicks_total ?? 0} />
      </section>

      {/* daily trend */}
      {(s.daily ?? []).length > 1 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">Visitas por día</h2>
          <div className="flex h-32 items-end gap-1.5">
            {(s.daily ?? []).map((x) => (
              <div key={x.day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-accent/70"
                  style={{ height: `${Math.round((x.n / maxDaily) * 100)}%` }}
                  title={`${x.day}: ${x.n}`}
                />
                <span className="text-[9px] text-muted">{x.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <RankCard title="Cómo entran" subtitle="Fuente de tráfico" rows={(s.sources ?? []).map((r) => ({ label: r.source, n: r.n }))} />
        <RankCard title="Páginas más vistas" rows={(s.top_pages ?? []).map((r) => ({ label: r.path, n: r.n }))} />
        <RankCard title="Dónde dan click" subtitle="Enlaces y botones" rows={(s.clicks ?? []).map((r) => ({ label: r.target, n: r.n }))} />
        <RankCard title="Dispositivo" rows={(s.devices ?? []).map((r) => ({ label: r.device === "mobile" ? "Móvil" : "Escritorio", n: r.n }))} />
      </div>

      {/* ---- Producto: que se vende, en que talla y color, y que convierte ---- */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Producto</h2>
        <p className="nums text-sm text-muted">
          {paresTotal.toLocaleString("es-MX")} pares · {mxn0(ingresosTotal)} · ticket {paresTotal ? mxn0(ingresosTotal / paresTotal) : "—"}/par
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <RankCard title="Más vendidos" subtitle="Pares cobrados en el rango"
          rows={topVendidos.map(([nombre, e]) => ({ label: nombre, n: e.pares }))} />
        <RankCard title="Ingresos por modelo" subtitle="Lo cobrado, en pesos"
          rows={topIngresos.map(([nombre, e]) => ({ label: `${nombre} · ${mxn0(e.ingresos)}`, n: Math.round(e.ingresos / 100) }))} />
        <RankCard title="Tallas más pedidas" rows={topTallas.map(([t, n]) => ({ label: t, n }))} />
        <RankCard title="Colores más pedidos" rows={topColores.map(([c, n]) => ({ label: c, n }))} />
      </div>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Conversión por modelo</h2>
        <p className="text-xs text-muted">Vistas de su página → pares vendidos (rango elegido, modelos con 5+ vistas)</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="pb-2">Modelo</th><th className="pb-2 text-right">Vistas</th><th className="pb-2 text-right">Pares</th><th className="pb-2 text-right">Conversión</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {conversion.length === 0 && <tr><td colSpan={4} className="py-4 text-muted">Sin datos suficientes en este rango.</td></tr>}
              {conversion.map((x) => (
                <tr key={x.nombre}>
                  <td className="py-2">{x.nombre}</td>
                  <td className="nums py-2 text-right text-muted">{x.vistas.toLocaleString("es-MX")}</td>
                  <td className="nums py-2 text-right">{x.pares}</td>
                  <td className="nums py-2 text-right font-medium">{(x.tasa * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(s.pageviews ?? 0) === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
          Aún no hay datos en este rango. Las visitas empiezan a registrarse en cuanto alguien navega la tienda.
        </p>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        {icon}
      </div>
      <p className="nums mt-2 text-3xl font-semibold">{value.toLocaleString("es-MX")}</p>
    </div>
  );
}

function RankCard({ title, subtitle, rows }: { title: string; subtitle?: string; rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      <ul className="mt-4 space-y-2.5">
        {rows.length === 0 && <li className="text-sm text-muted">Sin datos.</li>}
        {rows.map((r, i) => (
          <li key={i} className="min-w-0 text-sm">
            <div className="flex w-full min-w-0 items-baseline justify-between gap-3">
              <span className="min-w-0 flex-1 truncate" title={r.label}>{r.label || "—"}</span>
              <span className="nums shrink-0 font-medium">{r.n.toLocaleString("es-MX")}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
              <div className="h-full rounded-full bg-accent/60" style={{ width: `${Math.min(100, Math.round((r.n / max) * 100))}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
