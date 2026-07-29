import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaidEmail } from "@/lib/email";
import { stampOrderCfdi } from "@/lib/cfdi";
import { notifyAdmins } from "@/lib/push";
import { sendPurchaseToMeta } from "@/lib/meta-capi";
import { metaContentId } from "@/lib/meta-content";
import { methodLabel } from "@/lib/payment-method";
import { SITE_URL } from "@/lib/site";
import { formatCents } from "@/lib/money";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

type PaidMethod = "card" | "oxxo" | "spei" | "aplazo" | "mercadopago";

// Commit a paid order and fire the confirm-time side effects (email, Meta CAPI,
// admin push, CFDI). Shared by the Conekta and MercadoPago webhooks so the money
// path lives in one place. Idempotent: commit_order no-ops on a non-pending
// order, so webhook retries are safe.
export async function markOrderPaid(opts: {
  orderId: string;
  chargeId: string;
  amountCents: number;
  method: PaidMethod;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { error } = await admin.rpc("commit_order", {
    p_order_id: opts.orderId,
    p_charge_id: opts.chargeId,
    p_amount_cents: opts.amountCents,
    p_method: opts.method,
  });
  if (error) return { ok: false, error: error.message };

  const { data: order } = await admin
    .from("orders")
    .select(
      "email, order_number, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, needs_invoice, shipping_address",
    )
    .eq("id", opts.orderId)
    .maybeSingle();
  if (!order) return { ok: true }; // committed; nothing left to notify

  const { data: items } = await admin
    .from("order_items")
    .select("product_name, variant_label, unit_price_cents, quantity, variants(color, products(slug))")
    .eq("order_id", opts.orderId);

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

  // report the confirmed conversion to Meta (browser pixel can't for redirect /
  // async methods: the buyer already left the page)
  const ship = (order as { shipping_address?: Record<string, string> }).shipping_address;
  const contentIds = (items ?? [])
    .map((i) => {
      const v = i.variants as unknown as { color?: string; products?: { slug?: string } } | null;
      return v?.products?.slug && v.color ? metaContentId(v.products.slug, v.color) : null;
    })
    .filter((x): x is string => !!x);
  await sendPurchaseToMeta({
    eventId: order.order_number,
    orderNumber: order.order_number,
    email: order.email,
    phone: ship?.phone,
    valueCents: order.total_cents,
    contentIds,
    sourceUrl: `${SITE_URL}/checkout`,
  });

  await notifyAdmins({
    title: `Pago recibido · ${mxn(order.total_cents)}`,
    body: `${order.order_number} — ${methodLabel(opts.method)}. Listo para producción.`,
    url: `/admin/orders/${opts.orderId}`,
    tag: `order-${opts.orderId}`,
  });

  // stamp CFDI on payment if requested (non-fatal; records failure for admin retry)
  if (order.needs_invoice) await stampOrderCfdi(opts.orderId);
  return { ok: true };
}
