import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMpPayment } from "@/lib/mercadopago";
import { markOrderPaid } from "@/lib/order-fulfillment";

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

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, total_cents")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order) {
    console.error("[mercadopago webhook] no order for external_reference:", orderNumber, "payment:", paymentId);
    return NextResponse.json({ ok: true });
  }

  // defense-in-depth: the preference fixes the amount server-side, but never
  // commit an order against a payment whose amount doesn't match our total.
  if (pay.transaction_amount != null && Math.round(pay.transaction_amount * 100) !== order.total_cents) {
    console.error("[mercadopago webhook] amount mismatch:", orderNumber, "paid", pay.transaction_amount, "expected", order.total_cents / 100);
    return NextResponse.json({ ok: true });
  }

  const chargeId = `mp_${paymentId}`;
  const res = await markOrderPaid({
    orderId: order.id,
    chargeId,
    amountCents: order.total_cents,
    method: "mercadopago",
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });

  // commit_order hardcodes provider='conekta' on the payments row; relabel this
  // one so the money table stays honest about where it came from.
  await admin.from("payments").update({ provider: "mercadopago" }).eq("provider_charge_id", chargeId);

  return NextResponse.json({ ok: true });
}
