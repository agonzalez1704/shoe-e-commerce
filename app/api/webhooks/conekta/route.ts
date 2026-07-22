import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConektaOrder } from "@/lib/conekta";
import { sendPaidEmail } from "@/lib/email";
import { stampOrderCfdi } from "@/lib/cfdi";
import { notifyAdmins } from "@/lib/push";
import { sendPurchaseToMeta } from "@/lib/meta-capi";
import { SITE_URL } from "@/lib/site";
import { formatCents } from "@/lib/money";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

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
  if (co.payment_status !== "paid") {
    return NextResponse.json({ ok: true });
  }

  if (!payment.method) {
    return NextResponse.json({ ok: true }); // payment row incomplete, skip
  }

  const { error } = await admin.rpc("commit_order", {
    p_order_id: payment.order_id,
    p_charge_id: conektaOrderId,
    p_amount_cents: payment.amount_cents,
    p_method: payment.method as "card" | "oxxo" | "spei" | "aplazo",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // confirmation email (non-fatal)
  const { data: order } = await admin
    .from("orders")
    .select("email, order_number, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, needs_invoice, shipping_address")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (order) {
    const { data: items } = await admin
      .from("order_items")
      .select("product_name, variant_label, unit_price_cents, quantity")
      .eq("order_id", payment.order_id);
    await sendPaidEmail({
      to: order.email,
      orderNumber: order.order_number,
      totalCents: order.total_cents,
      lines: (items ?? []).map((i) => ({
        name: `${i.product_name} (${i.variant_label})`,
        quantity: i.quantity,
        lineTotalCents: i.unit_price_cents * i.quantity,
      })),
      breakdown: {
        subtotalCents: order.subtotal_cents,
        discountCents: order.discount_cents,
        shippingCents: order.shipping_cents,
        taxCents: order.tax_cents,
      },
    });
    // report the confirmed conversion to Meta (browser pixel can't: cash/SPEI
    // confirm long after the buyer left)
    const ship = (order as { shipping_address?: Record<string, string> }).shipping_address;
    await sendPurchaseToMeta({
      eventId: order.order_number,
      orderNumber: order.order_number,
      email: order.email,
      phone: ship?.phone,
      valueCents: order.total_cents,
      sourceUrl: `${SITE_URL}/checkout`,
    });

    await notifyAdmins({
      title: `Pago recibido · ${mxn(order.total_cents)}`,
      body: `${order.order_number} — ${payment.method.toUpperCase()}. Listo para producción.`,
      url: `/admin/orders/${payment.order_id}`,
      tag: `order-${payment.order_id}`,
    });

    // stamp CFDI on payment if requested (non-fatal; records failure for admin retry)
    if (order.needs_invoice) await stampOrderCfdi(payment.order_id);
  }

  return NextResponse.json({ ok: true });
}
