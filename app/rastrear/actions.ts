"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type TrackedOrder = {
  orderNumber: string;
  status: string;
  stage: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  sucursal: string | null;
  trackingUrl: string | null;
  reviewToken: string | null;
  garantia: {
    razon: string; recibido: boolean; cerrada: boolean;
    retorno: { carrier: string | null; tracking: string; url: string | null; label: string | null } | null;
    repo: { carrier: string | null; tracking: string; url: string | null } | null;
  } | null;
  estimatedDelivery: string | null;
  paymentMethod: string | null;
  totalCents: number;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: { name: string; quantity: number }[];
  shipping: Record<string, string> | null;
  payment: { status: string; reference: string | null; clabe: string | null; voucherUrl: string | null } | null;
};

const COLUMNAS =
  "id, order_number, status, fulfillment_stage, carrier, tracking_number, tracking_url, estimated_delivery, review_token, payment_method, total_cents, created_at, shipping_address, paid_at, shipped_at, delivered_at";

// Siempre con un segundo factor: correo (formulario) o token del pedido (link
// de los correos). Solo el numero de pedido permitiria enumerar pedidos ajenos.
async function buscar(orderNumber: string, filtro: { email: string } | { token: string }) {
  const admin = createAdminClient();
  let q = admin.from("orders").select(COLUMNAS).eq("order_number", orderNumber.trim().toUpperCase());
  if ("email" in filtro) q = q.ilike("email", filtro.email.trim());
  else {
    if (!/^[0-9a-f-]{36}$/i.test(filtro.token)) return null;
    q = q.eq("review_token", filtro.token);
  }
  const { data } = await q.maybeSingle();
  return data;
}

async function armar(order: NonNullable<Awaited<ReturnType<typeof buscar>>>): Promise<TrackedOrder> {
  const admin = createAdminClient();
  const [{ data: items }, { data: payment }, { data: garantia }] = await Promise.all([
    admin.from("order_items").select("product_name, variant_label, quantity").eq("order_id", order.id),
    admin
      .from("payments")
      .select("status, reference, clabe, voucher_url")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("garantias")
      .select("razon, recibido_at, cerrada_at, retorno_carrier, retorno_tracking, retorno_url, retorno_label_url, repo_carrier, repo_tracking, repo_url")
      .eq("order_id", order.id)
      .maybeSingle(),
  ]);

  return {
    orderNumber: order.order_number,
    stage: order.fulfillment_stage,
    carrier: order.carrier,
    trackingNumber: order.tracking_number,
    sucursal: ((order.shipping_address ?? {}) as { sucursal?: string }).sucursal ?? null,
    trackingUrl: order.tracking_url,
    reviewToken: order.review_token ?? null,
    garantia: garantia
      ? {
          razon: garantia.razon,
          recibido: !!garantia.recibido_at,
          cerrada: !!garantia.cerrada_at,
          retorno: garantia.retorno_tracking
            ? { carrier: garantia.retorno_carrier, tracking: garantia.retorno_tracking, url: garantia.retorno_url, label: garantia.retorno_label_url }
            : null,
          repo: garantia.repo_tracking
            ? { carrier: garantia.repo_carrier, tracking: garantia.repo_tracking, url: garantia.repo_url }
            : null,
        }
      : null,
    estimatedDelivery: order.estimated_delivery,
    status: order.status,
    paymentMethod: order.payment_method,
    totalCents: order.total_cents,
    createdAt: order.created_at,
    paidAt: order.paid_at,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
    items: (items ?? []).map((i) => ({ name: `${i.product_name} (${i.variant_label})`, quantity: i.quantity })),
    shipping: (order.shipping_address ?? null) as Record<string, string> | null,
    payment: payment
      ? { status: payment.status, reference: payment.reference, clabe: payment.clabe, voucherUrl: payment.voucher_url }
      : null,
  };
}

// Formulario: numero + correo. Con limite por IP contra adivinanzas.
export async function lookupOrder(
  orderNumber: string,
  email: string,
): Promise<{ order: TrackedOrder } | { error: string }> {
  const ip = await clientIp();
  if (!(await rateLimit("track", ip, 20, 60))) {
    return { error: "Demasiados intentos. Espera un momento." };
  }
  const order = await buscar(orderNumber, { email });
  if (!order) return { error: "No encontramos ese pedido. Verifica el número y el correo." };
  return { order: await armar(order) };
}

// Link de los correos: numero + token del pedido, sin teclear nada.
export async function ordenPorToken(orderNumber: string, token: string): Promise<TrackedOrder | null> {
  const order = await buscar(orderNumber, { token });
  return order ? armar(order) : null;
}
