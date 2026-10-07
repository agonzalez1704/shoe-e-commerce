import { NextResponse, type NextRequest } from "next/server";
import { getMpPayment } from "@/lib/mercadopago";
import { confirmarPagoExterno } from "@/lib/order-fulfillment";

// MercadoPago -> us. Checkout Pro confirms the payment here; the buyer's redirect
// back to /gracias happens in parallel and can't be trusted. Two-layer trust:
// shared secret in the URL + re-fetch the payment from MP before committing stock.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // MP delivers the payment id a few different ways: query (?type=payment&data.id=)
  // for Webhooks, or a JSON body ({type|action, data:{id}}). Handle both.
  const q = req.nextUrl.searchParams;
  let type = q.get("type") ?? q.get("topic");
  let paymentId = q.get("data.id") ?? (type === "payment" ? q.get("id") : null);
  try {
    const body = await req.json();
    type = type ?? body?.type ?? (typeof body?.action === "string" ? body.action.split(".")[0] : undefined);
    paymentId = paymentId ?? (body?.data?.id != null ? String(body.data.id) : null);
  } catch {
    /* query-only notification, no body */
  }

  // MP also pings for merchant_order / plan events — only payment events matter.
  if (type && !/payment/i.test(type)) return NextResponse.json({ ok: true });
  if (!paymentId) return NextResponse.json({ ok: true });

  const pay = await getMpPayment(paymentId);
  if (pay.status !== "approved") return NextResponse.json({ ok: true }); // pending / rejected

  const orderNumber = pay.external_reference;
  if (!orderNumber) return NextResponse.json({ ok: true });

  const res = await confirmarPagoExterno({
    orderNumber,
    chargeId: `mp_${paymentId}`,
    amountCents: pay.transaction_amount != null ? Math.round(pay.transaction_amount * 100) : null,
    method: "mercadopago",
  });
  if (!res.ok) {
    console.error("[mercadopago webhook]", res.error, "payment:", paymentId);
    // monto o pedido que no cuadra: no reintentar; un fallo del commit si
    if (/monto|sin pedido/.test(res.error)) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
