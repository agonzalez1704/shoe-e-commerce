import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePagePermiso } from "@/lib/permisos-guard";
import { dashboardSpecSchema, RANGOS } from "@/lib/dashboards";
import { resuelveWidget } from "@/lib/dashboards-widgets";
import { EditorDashboard } from "@/components/admin/EditorDashboard";

// Editor conversacional: overlay a pantalla completa (el sidebar del admin
// queda fuera), chat de parcheo a la izquierda y el canvas vivo a la derecha.
export const instant = false;

export default async function EditarDashboard({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermiso("metricas_ver");
  const { id } = await params;
  const supabase = await createClient();
  const { data: fila } = await supabase.from("dashboards").select("id, spec").eq("id", id).maybeSingle();
  if (!fila) notFound();
  const parsed = dashboardSpecSchema.safeParse(fila.spec);
  if (!parsed.success) notFound();

  const rango = parsed.data.rango as keyof typeof RANGOS;
  const widgets = await Promise.all(parsed.data.widgets.map((w) => resuelveWidget(w, rango)));
  return <EditorDashboard dashboardId={fila.id} titulo={parsed.data.titulo} widgets={widgets} />;
}
