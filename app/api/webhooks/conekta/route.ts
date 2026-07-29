import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConektaOrder } from "@/lib/conekta";
import { sendExpiredEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/push";
import { markOrderPaid } from "@/lib/order-fulfillment";
import { SITE_URL } from "@/lib/site";

// Conekta -> us. OXXO/SPEI confirm here asynchronously; card double-fires (idempotent).
// Two-layer trust: shared secret in the URL + re-fetch the order from Conekta to
// confirm payment_status before committing stock. Never trust the payload alone.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CONEKTA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let event: { type?: string; data?: { object?: { id?: string } } };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const conektaOrderId = event.data?.object?.id;
  if (!conektaOrderId) {
    return NextResponse.json({ ok: true }); // nothing to act on
  }
  // We don't filter on event.type: the payment lookup + Conekta re-fetch below
  // are the gate. Order events match our recorded order id; charge/other events
  // simply miss the lookup or aren't 'paid', so they no-op.

  const admin = createAdminClient();

  // map Conekta order -> our order via the recorded payment
  const { data: payment } = await admin
    .from("payments")
    .select("order_id, method, amount_cents")
    .eq("provider_charge_id", conektaOrderId)
    .maybeSingle();

  if (!payment) {
    // paid Conekta order with no local match = money received, no order to fulfill.
    // Should never happen post record_payment fix; log loudly if it does.
    console.error("[conekta webhook] no local payment for Conekta order:", conektaOrderId, "event:", event.type);
    return NextResponse.json({ ok: true });
  }

  // anti-spoof: confirm with Conekta directly
  const co = await getConektaOrder(conektaOrderId);

  // voucher expired / charge declined / voided -> release the order so the
  // reserved stock comes back, and tell the buyer. Idempotent: cancel_order
  // only touches a still-pending order.
  if (/expired|declined|voided|canceled|cancelled/i.test(co.payment_status ?? "")) {
    const { data: o } = await admin
      .from("orders")
      .select("order_number, status, email")
      .eq("id", payment.order_id)
      .maybeSingle();
    if (o && o.status === "pending") {
      await admin.rpc("cancel_order", { p_order_id: payment.order_id });
      await sendExpiredEmail({ to: o.email, orderNumber: o.order_number, shopUrl: `${SITE_URL}/products` });
      await notifyAdmins({
        title: "Pago vencido",
        body: `${o.order_number} — la referencia venció sin pago. Stock liberado.`,
        url: `/admin/orders/${payment.order_id}`,
        tag: `order-${payment.order_id}`,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (co.payment_status !== "paid") {
    return NextResponse.json({ ok: true });
  }

  if (!payment.method) {
    return NextResponse.json({ ok: true }); // payment row incomplete, skip
  }

  const res = await markOrderPaid({
    orderId: payment.order_id,
    chargeId: conektaOrderId,
    amountCents: payment.amount_cents,
    method: payment.method as "card" | "oxxo" | "spei" | "aplazo",
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });

  return NextResponse.json({ ok: true });
}
