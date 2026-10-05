import "server-only";

import { cookies } from "next/headers";
import { activeBrand } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { pasoCliente, ventanaEntrega } from "@/lib/fulfillment";

// El pedido que se acaba de hacer en este navegador. Casi todos compran sin
// cuenta: sin esto, al pagar no les quedaba dónde volver a ver su pedido
// (Dayilu, BL-001232, 7 minutos dando vueltas entre carrito y cuenta). Guarda
// número + review_token, el mismo par que abre el pedido desde los correos.
const COOKIE = `${activeBrand.key}_pedido`;
const DIAS = 60;

export const urlPedido = (numero: string, token: string, nuevo = false) =>
  `/pedido/${encodeURIComponent(numero)}?t=${token}${nuevo ? "&nuevo=1" : ""}`;

// Solo desde una server action o route handler (Next no deja escribir cookies al renderizar).
export async function guardaPedidoReciente(numero: string, token: string) {
  (await cookies()).set(COOKIE, `${numero}.${token}`, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: DIAS * 86400,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function leePedidoReciente(): Promise<{ numero: string; token: string } | null> {
  const v = (await cookies()).get(COOKIE)?.value ?? "";
  const m = v.match(/^([A-Z]{2,4}-\d+)\.([0-9a-f-]{36})$/i);
  return m ? { numero: m[1].toUpperCase(), token: m[2] } : null;
}

export type EstadoBarra = "pendiente" | "produccion" | "listo" | "camino" | "entregado";
export type PedidoReciente = {
  numero: string; url: string; estado: EstadoBarra; etiqueta: string; detalle: string | null; creadoHace: number;
};

const ETIQUETA: Record<EstadoBarra, string> = {
  pendiente: "Pago pendiente",
  produccion: "En producción",
  listo: "Listo para enviar",
  camino: "En camino",
  entregado: "Entregado",
};

// El estado que pinta la barra. null = no hay nada que mostrar: sin cookie,
// token que no cuadra, pedido cancelado/vencido, o entregado hace más de 7 días.
export async function pedidoReciente(): Promise<PedidoReciente | null> {
  const c = await leePedidoReciente();
  if (!c) return null;
  const { data: o } = await createAdminClient()
    .from("orders")
    .select("order_number, status, fulfillment_stage, tracking_number, paid_at, shipped_at, delivered_at, created_at, expires_at")
    .eq("order_number", c.numero)
    .eq("review_token", c.token)
    .maybeSingle();
  if (!o || o.status === "cancelled" || o.status === "refunded") return null;
  if (o.status === "pending" && o.expires_at && new Date(o.expires_at).getTime() < Date.now()) return null;
  if (o.delivered_at && Date.now() - new Date(o.delivered_at).getTime() > 7 * 86400_000) return null;

  const paso = pasoCliente(o.status, o.fulfillment_stage, !!o.tracking_number);
  const estado: EstadoBarra = (["pendiente", "produccion", "listo", "camino", "entregado"] as const)[paso];
  const detalle =
    estado === "pendiente" ? "Termina tu pago para que empecemos"
    : estado === "camino" && o.tracking_number ? `Guía ${o.tracking_number}`
    : estado !== "entregado" && o.paid_at ? `Llega ${ventanaEntrega(o.paid_at, o.shipped_at).texto}`
    : null;
  return {
    numero: o.order_number,
    url: urlPedido(o.order_number, c.token),
    estado,
    etiqueta: ETIQUETA[estado],
    detalle,
    creadoHace: Date.now() - new Date(o.created_at).getTime(),
  };
}
