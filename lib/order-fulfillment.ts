import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaidEmail, linkSeguimiento } from "@/lib/email";
import { stampOrderCfdi } from "@/lib/cfdi";
import { notifyAdmins } from "@/lib/push";
import { sendPurchaseToMeta } from "@/lib/meta-capi";
import { metaContentId } from "@/lib/meta-content";
import { methodLabel } from "@/lib/payment-method";
import { SITE_URL } from "@/lib/site";
import { formatCents } from "@/lib/money";
import { ventanaEntrega } from "@/lib/fulfillment";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

type PaidMethod = "card" | "oxxo" | "spei" | "aplazo" | "mercadopago";

// Commit a paid order and fire the confirm-time side effects (email, Meta CAPI,
// admin push, CFDI). Shared by the checkout (card cleared at once) and the
// Conekta / MercadoPago webhooks so the money path lives in one place.
export async function markOrderPaid(opts: {
  orderId: string;
  chargeId: string;
  amountCents: number;
  method: PaidMethod;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  // commit_order no-ops on a non-pending order, so retries are safe for stock.
  const { error } = await admin.rpc("commit_order", {
    p_order_id: opts.orderId,
    p_charge_id: opts.chargeId,
    p_amount_cents: opts.amountCents,
    p_method: opts.method,
  });
  if (error) return { ok: false, error: error.message };

  // Efectos una sola vez. Dos webhooks simultaneos (o checkout + webhook)
  // confirmaban el mismo pago y ambos mandaban correo, Meta y push. Gana quien
  // sella efectos_pago_at; el UPDATE condicional es atomico en Postgres.
  const { data: gano } = await admin
    .from("orders")
    .update({ efectos_pago_at: new Date().toISOString() })
    .eq("id", opts.orderId)
    .is("efectos_pago_at", null)
    .in("status", ["paid", "fulfilled"])
    .select("id")
    .maybeSingle();
  if (!gano) return { ok: true };

  const { data: order } = await admin
    .from("orders")
    .select(
      "email, order_number, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, needs_invoice, shipping_address, review_token, paid_at",
    )
    .eq("id", opts.orderId)
    .maybeSingle();
  if (!order) return { ok: true }; // committed; nothing left to notify

  const { data: items } = await admin
    .from("order_items")
    .select("product_name, variant_label, unit_price_cents, quantity")
    .eq("order_id", opts.orderId);

  await sendPaidEmail({
    trackUrl: linkSeguimiento(order.order_number, order.review_token),
    eta: order.paid_at ? ventanaEntrega(order.paid_at).texto : undefined,
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

  await reportarCompraMeta(opts.orderId);

  await notifyAdmins({
    title: `Pago recibido · ${mxn(order.total_cents)}`,
    body: `${order.order_number} — ${methodLabel(opts.method)}. Listo para producción.`,
    url: `/admin/orders/${opts.orderId}`,
    // Tag propio: con el tag del pedido, esta notificacion REEMPLAZABA a la de
    // "Pedido nuevo" en la bandeja, y un reemplazo es silencioso en iOS (no
    // soporta renotify) y a veces en Android. El pago es la noticia que mas
    // importa: que suene siempre.
    tag: `order-${opts.orderId}-pagado`,
  });

  // stamp CFDI on payment if requested (non-fatal; records failure for admin retry)
  if (order.needs_invoice) await stampOrderCfdi(opts.orderId);
  return { ok: true };
}

// Reporta la compra a Meta desde el servidor y deja constancia en capi_envios.
// La usa markOrderPaid y la reconciliacion del cron (reenvio de las que no
// llegaron). event_id = numero de pedido: Meta junta los reenvios y la copia
// del navegador en una sola compra.
export async function reportarCompraMeta(orderId: string) {
  const admin = createAdminClient();
  const { data: o } = await admin
    .from("orders")
    .select("order_number, email, total_cents, paid_at, shipping_address, atribucion")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return;
  const { data: items } = await admin
    .from("order_items")
    .select("variants(color, products(slug))")
    .eq("order_id", orderId);

  const ship = (o.shipping_address ?? {}) as Record<string, string>;
  const atrib = (o.atribucion ?? {}) as Record<string, string>;
  const contentIds = (items ?? [])
    .map((i) => {
      const v = i.variants as unknown as { color?: string; products?: { slug?: string } } | null;
      return v?.products?.slug && v.color ? metaContentId(v.products.slug, v.color) : null;
    })
    .filter((x): x is string => !!x);

  const r = await sendPurchaseToMeta({
    eventId: o.order_number,
    orderNumber: o.order_number,
    email: o.email,
    phone: ship.phone,
    valueCents: o.total_cents,
    contentIds,
    sourceUrl: `${SITE_URL}/checkout`,
    eventTime: o.paid_at ? Math.floor(new Date(o.paid_at).getTime() / 1000) : undefined,
    fbc: atrib.fbc,
    fbp: atrib.fbp,
    ip: atrib.ip,
    userAgent: atrib.ua,
  });
  if ("skipped" in r) return;
  await admin.from("capi_envios").insert({
    order_id: orderId,
    event_id: o.order_number,
    ok: r.ok,
    respuesta: (r.detail ?? "").slice(0, 500),
  });
}
