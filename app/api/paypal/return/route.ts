import { NextResponse, type NextRequest } from "next/server";
import { capturePaypalOrder } from "@/lib/paypal";
import { confirmarPagoExterno } from "@/lib/order-fulfillment";
import { SITE_URL } from "@/lib/site";
import { notifyAdmins } from "@/lib/push";

// PayPal regresa aqui al aprobar (?o=<pedido>&token=<orden PayPal>&PayerID=…).
// Capturamos en el servidor: el cobro existe solo si la captura sale COMPLETED,
// y el pedido se confirma contra el custom_id y el monto que reporta PayPal,
// nunca contra lo que diga la URL.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const pedido = (q.get("o") ?? "").toUpperCase();
  const ppOrderId = q.get("token");
  const gracias = (extra = "") => NextResponse.redirect(`${SITE_URL}/checkout/gracias?o=${encodeURIComponent(pedido)}${extra}`);
  if (!pedido || !ppOrderId) return gracias("&paypal=incompleto");

  const cap = await capturePaypalOrder(ppOrderId);
  if (!cap.ok) {
    // Tarjeta rechazada dentro de PayPal: de vuelta a PayPal para elegir otra.
    if (cap.reintentar) {
      const host = process.env.PAYPAL_ENV === "sandbox" ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";
      return NextResponse.redirect(`${host}/checkoutnow?token=${encodeURIComponent(ppOrderId)}`);
    }
    return gracias("&paypal=rechazado");
  }
  // El pedido sale de PayPal, no de la URL: sin custom_id no se confirma nada.
  if (!cap.orderNumber || cap.orderNumber !== pedido) {
    console.error("[paypal return] custom_id no coincide:", cap.orderNumber, "vs", pedido);
    await notifyAdmins({ title: `PayPal cobró pero no se pudo ligar a ${pedido}`, body: `captura ${cap.captureId}`, url: "/admin/orders", tag: `pp-${pedido}` });
    return gracias("&paypal=error");
  }

  const res = await confirmarPagoExterno({
    orderNumber: cap.orderNumber,
    chargeId: `pp_${cap.captureId}`,
    amountCents: cap.amountCents,
    method: "paypal",
  });
  if (!res.ok) {
    // Cobrado en PayPal pero no confirmado aqui: hay que verlo a mano.
    console.error("[paypal return] captura sin confirmar:", res.error, cap.captureId);
    await notifyAdmins({ title: `PayPal cobró ${pedido} pero no se confirmó`, body: res.error, url: "/admin/orders", tag: `pp-${pedido}` });
    return gracias("&paypal=revisar");
  }
  return gracias();
}
