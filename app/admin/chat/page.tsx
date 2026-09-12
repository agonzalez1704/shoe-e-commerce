import { requirePagePermiso } from "@/lib/permisos-guard";
import { ChatNegocio } from "@/components/admin/ChatNegocio";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;

export default async function AdminChat() {
  await requirePagePermiso("metricas_ver");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Asistente</h1>
      <ChatNegocio />
    </div>
  );
}
