import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePagePermiso } from "@/lib/permisos-guard";
import { dashboardSpecSchema, ejecutarConsulta, type WidgetSpec, RANGOS } from "@/lib/dashboards";
import { Widget, type WidgetDatos } from "@/components/admin/WidgetsDashboard";

// Render del dashboard generativo: el spec (JSON declarativo) se resuelve a
// datos AQUI, al abrirlo — dashboards vivos, nunca fotos viejas.
export const instant = false;

const ETIQUETA_RANGO = { hoy: "Hoy", "7d": "7 días", "30d": "30 días", "90d": "90 días" } as const;

async function resuelveWidget(w: WidgetSpec, rango: keyof typeof RANGOS): Promise<WidgetDatos> {
  if (w.tipo === "nota") return { tipo: "nota", titulo: w.titulo, w: w.w, texto: w.texto };
  if (w.tipo === "kpi") {
    const r = await ejecutarConsulta(w.consulta, rango);
    return { tipo: "kpi", titulo: w.titulo, w: w.w, unidad: r.unidad, valor: r.valor ?? 0, delta: r.delta };
  }
  if (w.tipo === "serie") {
    const series = await Promise.all(w.series.map(async (s) => {
      const r = await ejecutarConsulta(s.consulta, rango);
      return { nombre: s.nombre, datos: r.serie ?? [], unidad: r.unidad };
    }));
    return { tipo: "serie", titulo: w.titulo, w: w.w, forma: w.forma, unidad: series[0]?.unidad ?? "numero", series };
  }
  if (w.tipo === "distribucion") {
    const r = await ejecutarConsulta(w.consulta, rango);
    return { tipo: "distribucion", titulo: w.titulo, w: w.w, unidad: r.unidad, datos: (r.serie ?? []).slice(0, 5) };
  }
  const r = await ejecutarConsulta(w.consulta, rango);
  const filas = r.filas ?? (r.serie ?? []).map((s) => ({ etiqueta: s.etiqueta, valor: s.valor }));
  const columnas = r.columnas ?? ["etiqueta", "valor"];
  return { tipo: "tabla", titulo: w.titulo, w: w.w, columnas, filas };
}

export default async function DashboardPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  await requirePagePermiso("metricas_ver");
  const { id } = await params;
  const { d } = await searchParams;

  const supabase = await createClient();
  const { data: fila } = await supabase.from("dashboards").select("id, nombre, spec, updated_at").eq("id", id).maybeSingle();
  if (!fila) notFound();

  const parsed = dashboardSpecSchema.safeParse(fila.spec);
  if (!parsed.success) {
    return <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-accent">El spec de este dashboard no es válido: {parsed.error.issues[0]?.message}</p>;
  }
  const spec = parsed.data;
  const rango = (d && d in RANGOS ? d : spec.rango) as keyof typeof RANGOS;
  const widgets = await Promise.all(spec.widgets.map((w) => resuelveWidget(w, rango)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/dashboards" className="text-xs text-muted hover:text-text">← Dashboards</Link>
          <h1 className="text-xl font-semibold tracking-tight">{spec.titulo}</h1>
          {spec.descripcion && <p className="text-xs text-muted">{spec.descripcion}</p>}
        </div>
        <div className="flex gap-1 rounded-full border border-border p-1">
          {(Object.keys(RANGOS) as (keyof typeof RANGOS)[]).map((r) => (
            <Link key={r} href={`/admin/dashboards/${fila.id}?d=${r}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${rango === r ? "bg-text text-bg" : "text-muted hover:text-text"}`}>
              {ETIQUETA_RANGO[r]}
            </Link>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6 lg:grid-cols-12">
        {widgets.map((w, i) => <Widget key={i} datos={w} />)}
      </div>
    </div>
  );
}
