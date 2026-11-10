import { assertPermiso } from "@/lib/permisos-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { fichaEfectivo } from "@/lib/ficha-efectivo";

// PNG de la ficha de efectivo: código, pasos y logos de las tiendas.
export async function GET(req: Request, { params }: { params: Promise<{ numero: string }> }) {
  try {
    await assertPermiso("pedidos_gestionar");
  } catch {
    return new Response("Sin permiso", { status: 403 });
  }

  const { numero } = await params;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders").select("id, total_cents, status, payment_method").eq("order_number", numero).maybeSingle();
  if (!order || order.payment_method !== "oxxo") return new Response("Pedido no encontrado", { status: 404 });
  if (order.status !== "pending") return new Response("Esta ficha ya no está vigente", { status: 410 });

  const { data: pago } = await admin
    .from("payments").select("reference, voucher_url, expires_at")
    .eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!pago?.reference) return new Response("El pedido no tiene referencia", { status: 404 });

  return fichaEfectivo(
    { numero, totalCents: order.total_cents, referencia: pago.reference, barcodeUrl: pago.voucher_url, venceEn: pago.expires_at },
    new URL(req.url).origin,
    { "Content-Disposition": `attachment; filename="ficha-${numero}.png"`, "Cache-Control": "private, no-store" },
  );
}
