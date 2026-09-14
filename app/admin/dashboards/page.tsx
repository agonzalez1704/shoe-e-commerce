import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePagePermiso } from "@/lib/permisos-guard";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;

export default async function ListaDashboards() {
  await requirePagePermiso("metricas_ver");
  const supabase = await createClient();
  const { data } = await supabase.from("dashboards").select("id, nombre, updated_at").order("updated_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Dashboards</h1>
        <p className="text-xs text-muted">Se crean y editan desde el Asistente</p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {(data ?? []).length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted">
            Aún no hay dashboards. Pídele uno al <Link href="/admin/chat" className="text-accent underline">Asistente</Link>: “hazme un dashboard de ventas del mes”.
          </li>
        )}
        {(data ?? []).map((d) => (
          <li key={d.id}>
            <Link href={`/admin/dashboards/${d.id}`} className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-elevated">
              <span className="font-medium">{d.nombre}</span>
              <span className="nums text-xs text-muted">{new Date(d.updated_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
