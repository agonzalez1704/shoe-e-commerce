import Link from "next/link";
import { Eye, Users, CursorClick } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
  const { d } = await searchParams;
  const days = RANGES.some((r) => String(r.days) === d) ? Number(d) : 7;

  const supabase = await createClient();
  const { data } = await supabase.rpc("analytics_summary", { p_days: days });
  const s = (data ?? {}) as Partial<Summary>;

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
