"use server";

import { revalidatePath } from "next/cache";
import { requirePermiso, assertPermiso } from "@/lib/permisos-guard";
import { stampOrderCfdi } from "@/lib/cfdi";
import { sendShippedEmail, sendDeliveredEmail, sendVoucherEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/push";
import { stageLabel } from "@/lib/fulfillment";

type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

// Server actions are publicly invocable by any authenticated client, so every
// admin action verifies is_admin() — UI gating is not access control.
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await requirePermiso("pedidos_gestionar");
  // keep the fulfillment pipeline in sync: 'fulfilled' means it shipped, and
  // shipped_at is what drives the review-request cron.
  const patch: { status: OrderStatus; fulfillment_stage?: string; shipped_at?: string } = { status };
  if (status === "fulfilled") {
    patch.fulfillment_stage = "shipped";
    const { data: cur } = await supabase.from("orders").select("shipped_at").eq("id", orderId).maybeSingle();
    if (!cur?.shipped_at) patch.shipped_at = new Date().toISOString(); // don't reset an existing ship date
  }
  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) throw new Error(error.message);

  // notify the customer when the order ships (non-fatal)
  if (status === "fulfilled") {
    const { data: o } = await supabase
      .from("orders")
      .select("email, order_number, total_cents")
      .eq("id", orderId)
      .maybeSingle();
    if (o) {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, variant_label, unit_price_cents, quantity")
        .eq("order_id", orderId);
      await sendShippedEmail({
        to: o.email,
        orderNumber: o.order_number,
        totalCents: o.total_cents,
        lines: (items ?? []).map((i) => ({
          name: `${i.product_name} (${i.variant_label})`,
          quantity: i.quantity,
          lineTotalCents: i.unit_price_cents * i.quantity,
        })),
      });
    }
  }

  const { data: num } = await supabase.from("orders").select("order_number").eq("id", orderId).maybeSingle();
  await notifyAdmins({
    title: `Pedido ${STATUS_LABEL[status]}`,
    body: `${num?.order_number ?? "Pedido"} actualizado.`,
    url: `/admin/orders/${orderId}`,
    tag: `order-${orderId}`,
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "pendiente",
  paid: "pagado",
  fulfilled: "enviado",
  cancelled: "cancelado",
  refunded: "reembolsado",
};

type FulfillmentStage = "pending" | "in_production" | "ready" | "shipped" | "delivered";

// Save carrier / tracking / estimated-delivery for an order (no stage change).
export async function saveTracking(
  orderId: string,
  data: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null; estimatedDelivery: string | null },
) {
  const supabase = await requirePermiso("pedidos_gestionar");
  const { error } = await supabase
    .from("orders")
    .update({
      carrier: data.carrier || null,
      tracking_number: data.trackingNumber || null,
      tracking_url: data.trackingUrl || null,
      estimated_delivery: data.estimatedDelivery || null,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/orders/${orderId}`);
}

// Advance the delivery pipeline. Stamps shipped_at/delivered_at and notifies the
// customer (with tracking) when the order ships.
export async function setFulfillmentStage(orderId: string, stage: FulfillmentStage) {
  const supabase = await requirePermiso("pedidos_gestionar");

  const patch: {
    fulfillment_stage: FulfillmentStage;
    shipped_at?: string;
    delivered_at?: string;
    status?: OrderStatus;
  } = { fulfillment_stage: stage };
  if (stage === "shipped") patch.shipped_at = new Date().toISOString();
  if (stage === "delivered") patch.delivered_at = new Date().toISOString();

  // La sincronía entre las dos columnas era de una sola vía: updateOrderStatus
  // movía la etapa, pero mover la etapa no movía el estado. Un pedido acababa
  // Entregado y con status `paid` para siempre — nunca contaba como completado
  // en métricas ni en comisiones, y el filtro de Pago no lo distinguía de uno
  // que sigue fabricándose.
  //
  // Sólo desde `paid`: marcar entregado un pedido sin pagar no puede afirmar
  // que se cobró, y uno cancelado o reembolsado no vuelve a la vida. Y sólo
  // hacia adelante — retroceder la etapa no degrada el estado.
  //
  // No manda correo: el de envío ya lo despacha la rama `shipped` de abajo y el
  // de entrega la rama `delivered`; el cron de reseñas se dispara con
  // delivered_at/shipped_at, no con el estado.
  if (stage === "shipped" || stage === "delivered") {
    const { data: cur } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
    if (cur?.status === "paid") patch.status = "fulfilled";
  }

  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) throw new Error(error.message);

  if (stage === "shipped") {
    const { data: o } = await supabase
      .from("orders")
      .select("email, order_number, total_cents, carrier, tracking_number")
      .eq("id", orderId)
      .maybeSingle();
    if (o) {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, variant_label, unit_price_cents, quantity")
        .eq("order_id", orderId);
      await sendShippedEmail({
        to: o.email,
        orderNumber: o.order_number,
        totalCents: o.total_cents,
        carrier: o.carrier ?? undefined,
        tracking: o.tracking_number ?? undefined,
        lines: (items ?? []).map((i) => ({
          name: `${i.product_name} (${i.variant_label})`,
          quantity: i.quantity,
          lineTotalCents: i.unit_price_cents * i.quantity,
        })),
      });
    }
  }

  if (stage === "delivered") {
    const { data: o } = await supabase.from("orders").select("email, order_number").eq("id", orderId).maybeSingle();
    if (o) await sendDeliveredEmail({ to: o.email, orderNumber: o.order_number });
  }

  // mirror the change to every admin device, including the one that made it —
  // a solo operator still wants the confirmation on their phone
  const { data: num } = await supabase.from("orders").select("order_number").eq("id", orderId).maybeSingle();
  await notifyAdmins({
    title: `${stageLabel(stage)}`,
    body: `${num?.order_number ?? "Pedido"} cambió de etapa.`,
    url: `/admin/orders/${orderId}`,
    tag: `order-${orderId}`,
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

// Skydropx provider name → our carrier keys (lib/fulfillment CARRIERS).
const CARRIER_MAP: Record<string, string> = {
  estafeta: "estafeta", fedex: "fedex", dhl: "dhl",
  paquetexpress: "paquetexpress", ninetynineminutes: "99minutos", correos: "correos",
};

// Build the destination from the order itself. Both the quote and the label
// derive it here rather than accepting one from the browser: an address that
// arrives with the request is an address an attacker chose.
async function shipTo(supabase: Awaited<ReturnType<typeof requirePermiso>>, orderId: string) {
  const { data: o } = await supabase
    .from("orders")
    .select("shipping_address, email")
    .eq("id", orderId)
    .maybeSingle();
  if (!o?.shipping_address) throw new Error("El pedido no tiene dirección de envío.");
  const s = o.shipping_address as Record<string, string>;
  return {
    name: s.name || "Cliente",
    phone: s.phone || "",
    email: o.email,
    street1: s.line1 || "",
    area_level1: s.region || "",
    area_level2: s.city || "",
    area_level3: s.neighborhood || "",
    postal_code: s.postal || "",
    country_code: "MX",
  };
}

// León is delivered by us, so it never goes to Skydropx.
const esLeon = (to: { postal_code: string; area_level2: string }) =>
  to.postal_code.startsWith("37") || /le[oó]n/i.test(to.area_level2);

// Ask Skydropx what the couriers charge and how long they take. Creates
// nothing: the label is a separate, deliberate second step, so the operator
// picks on price and delivery time instead of always getting the cheapest.
export async function quoteSkydropxRates(orderId: string) {
  // Returns the failure instead of throwing: Next strips a thrown message in
  // production, so the operator got React #441 and no idea what Skydropx said.
  try {
    const supabase = await requirePermiso("pedidos_gestionar");
    const to = await shipTo(supabase, orderId);
    if (esLeon(to)) return { ok: true as const, local: true, rates: [], quotationId: "" };
    if (!to.area_level3 || !to.phone) {
      return { ok: false as const, error: "Falta colonia o teléfono en la dirección. Captúralos manualmente." };
    }
    const { quote } = await import("@/lib/skydropx");
    const { quotationId, rates } = await quote(to);
    return { ok: true as const, local: false, quotationId, rates };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falló la cotización" };
  }
}

// Create the shipment for the rate the operator chose. The rate is refetched
// from Skydropx by id — the browser sends only which one, never its price.
export async function createSkydropxLabel(orderId: string, quotationId: string, rateId: string) {
  // Same reason: Skydropx rejects with a specific field, and that message is
  // the whole diagnosis. Thrown, production replaces it with React #441.
  try {
    const supabase = await requirePermiso("pedidos_gestionar");
    const to = await shipTo(supabase, orderId);
    const { rateById, createShipment } = await import("@/lib/skydropx");
    const rate = await rateById(quotationId, rateId);
    if (!rate) return { ok: false as const, error: "Esa tarifa ya no está disponible. Vuelve a cotizar." };

    const r = await createShipment(quotationId, rate, to);
    const { error } = await supabase
      .from("orders")
      .update({
        carrier: CARRIER_MAP[r.carrier] ?? "other",
        tracking_number: r.trackingNumber || null,
        tracking_url: r.trackingUrl,
        shipping_label_url: r.labelUrl,
      })
      .eq("id", orderId);
    if (error) return { ok: false as const, error: error.message };

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true as const, carrier: r.carrier, tracking: r.trackingNumber, labelUrl: r.labelUrl };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falló la generación de guía" };
  }
}

// Kept for the León path and as a one-shot fallback: quote, take the cheapest,
// ship. Everything else should go through quote → choose → create.
export async function generateSkydropxLabel(orderId: string) {
  const supabase = await requirePermiso("pedidos_gestionar");
  const { data: o } = await supabase
    .from("orders")
    .select("shipping_address, email")
    .eq("id", orderId)
    .maybeSingle();
  if (!o?.shipping_address) throw new Error("El pedido no tiene dirección de envío.");

  const s = o.shipping_address as Record<string, string>;
  const to = {
    name: s.name || "Cliente",
    phone: s.phone || "",
    email: o.email,
    street1: s.line1 || "",
    area_level1: s.region || "",
    area_level2: s.city || "",
    area_level3: s.neighborhood || "",
    postal_code: s.postal || "",
    country_code: "MX",
  };
  // León local delivery: we handle logistics ourselves, no Skydropx.
  const isLeon = to.postal_code.startsWith("37") || /le[oó]n/i.test(to.area_level2);
  if (isLeon) {
    await supabase.from("orders").update({ carrier: "local", tracking_number: null, tracking_url: null, shipping_label_url: null }).eq("id", orderId);
    revalidatePath(`/admin/orders/${orderId}`);
    return { carrier: "local", tracking: "", labelUrl: null, local: true };
  }

  if (!to.area_level3 || !to.phone) {
    throw new Error("Falta colonia o teléfono en la dirección (pedido anterior a la actualización). Captúralos manualmente.");
  }

  const { generateLabel } = await import("@/lib/skydropx");
  const r = await generateLabel(to);

  const { error } = await supabase
    .from("orders")
    .update({
      carrier: CARRIER_MAP[r.carrier] ?? "other",
      tracking_number: r.trackingNumber || null,
      tracking_url: r.trackingUrl,
      shipping_label_url: r.labelUrl,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/orders/${orderId}`);
  return { carrier: r.carrier, tracking: r.trackingNumber, labelUrl: r.labelUrl };
}

// Re-send the cash/SPEI payment instructions (barcode + reference or CLABE).
// For buyers who lost the original mail and checked out as guests, this is the
// only way back to their voucher.
export async function resendPaymentInstructions(orderId: string) {
  const supabase = await requirePermiso("pedidos_gestionar");

  const { data: order } = await supabase
    .from("orders")
    .select("email, order_number, total_cents, status, payment_method, expires_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Pedido no encontrado.");
  if (order.status !== "pending") throw new Error("El pedido ya no está pendiente de pago.");
  if (order.payment_method !== "oxxo" && order.payment_method !== "spei") {
    throw new Error("Este pedido no se paga con referencia.");
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("reference, clabe, voucher_url")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment?.reference && !payment?.clabe) throw new Error("El pedido no tiene referencia de pago.");

  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, variant_label, unit_price_cents, quantity")
    .eq("order_id", orderId);

  await sendVoucherEmail({
    to: order.email,
    orderNumber: order.order_number,
    totalCents: order.total_cents,
    method: order.payment_method,
    reference: payment.reference ?? undefined,
    clabe: payment.clabe ?? undefined,
    voucherUrl: payment.voucher_url ?? undefined,
    expiresAt: order.expires_at,
    lines: (items ?? []).map((i) => ({
      name: `${i.product_name} (${i.variant_label})`,
      quantity: i.quantity,
      lineTotalCents: i.unit_price_cents * i.quantity,
    })),
  });

  return { sentTo: order.email };
}

// ---- discount codes ----
// create_order matches the code exactly, so codes are stored upper-cased and the
// checkout upper-cases what the buyer types.
export async function createDiscountCode(input: {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotalCents: number;
  maxUses: number | null;
  expiresAt: string | null;
}) {
  const supabase = await requirePermiso("descuentos_gestionar");
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("El código no puede estar vacío.");
  if (!(input.value > 0)) throw new Error("El valor debe ser mayor a 0.");
  if (input.type === "percent" && input.value > 100) throw new Error("El porcentaje no puede pasar de 100.");

  const { error } = await supabase.from("discount_codes").insert({
    code,
    type: input.type,
    value: input.value,
    min_subtotal_cents: Math.max(0, Math.round(input.minSubtotalCents)),
    max_uses: input.maxUses,
    expires_at: input.expiresAt,
    active: true,
  });
  if (error) throw new Error(error.code === "23505" ? "Ya existe un código con ese nombre." : error.message);
  revalidatePath("/admin/discounts");
}

export async function setDiscountActive(id: string, active: boolean) {
  const supabase = await requirePermiso("descuentos_gestionar");
  const { error } = await supabase.from("discount_codes").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/discounts");
}

export async function deleteDiscountCode(id: string) {
  const supabase = await requirePermiso("descuentos_gestionar");
  const { error } = await supabase.from("discount_codes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/discounts");
}

export async function setInventory(variantId: string, qtyOnHand: number) {
  const supabase = await requirePermiso("inventario_gestionar");
  const { error } = await supabase
    .from("inventory")
    .update({ qty_on_hand: Math.max(0, Math.floor(qtyOnHand)) })
    .eq("variant_id", variantId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/inventory");
}

// Save a whole colourway at once — counting stock means walking a shelf and
// typing every size, so one round trip beats eleven.
export async function setInventoryBulk(
  items: { variantId: string; qtyOnHand: number }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await requirePermiso("inventario_gestionar");
    if (!items.length) return { ok: true };
    for (const it of items) {
      const { error } = await supabase
        .from("inventory")
        .update({ qty_on_hand: Math.max(0, Math.floor(it.qtyOnHand)) })
        .eq("variant_id", it.variantId);
      if (error) throw new Error(error.message);
    }
    revalidatePath("/admin/inventory");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}

export async function setProductStatus(productId: string, status: "draft" | "active" | "archived") {
  const supabase = await requirePermiso("productos_gestionar");
  const { error } = await supabase.from("products").update({ status }).eq("id", productId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}

export async function stampInvoice(orderId: string) {
  await assertPermiso("facturar"); // critical: stampOrderCfdi uses the service-role client (bypasses RLS)
  const result = await stampOrderCfdi(orderId);
  revalidatePath(`/admin/orders/${orderId}`);
  return result;
}
