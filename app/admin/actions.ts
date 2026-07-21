"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { stampOrderCfdi } from "@/lib/cfdi";
import { sendShippedEmail, sendDeliveredEmail, sendVoucherEmail } from "@/lib/email";

type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

// Server actions are publicly invocable by any authenticated client, so every
// admin action verifies is_admin() — UI gating is not access control.
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await requireAdmin();
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

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

type FulfillmentStage = "pending" | "in_production" | "ready" | "shipped" | "delivered";

// Save carrier / tracking / estimated-delivery for an order (no stage change).
export async function saveTracking(
  orderId: string,
  data: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null; estimatedDelivery: string | null },
) {
  const supabase = await requireAdmin();
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
  const supabase = await requireAdmin();

  const patch: { fulfillment_stage: FulfillmentStage; shipped_at?: string; delivered_at?: string } = { fulfillment_stage: stage };
  if (stage === "shipped") patch.shipped_at = new Date().toISOString();
  if (stage === "delivered") patch.delivered_at = new Date().toISOString();

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

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

// Skydropx provider name → our carrier keys (lib/fulfillment CARRIERS).
const CARRIER_MAP: Record<string, string> = {
  estafeta: "estafeta", fedex: "fedex", dhl: "dhl",
  paquetexpress: "paquetexpress", ninetynineminutes: "99minutos", correos: "correos",
};

// Generate the shipping guía + label for an order via Skydropx (cheapest rate)
// and store carrier / tracking / label URL on the order.
export async function generateSkydropxLabel(orderId: string) {
  const supabase = await requireAdmin();
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
  const supabase = await requireAdmin();

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
  const supabase = await requireAdmin();
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
  const supabase = await requireAdmin();
  const { error } = await supabase.from("discount_codes").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/discounts");
}

export async function deleteDiscountCode(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("discount_codes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/discounts");
}

export async function setInventory(variantId: string, qtyOnHand: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("inventory")
    .update({ qty_on_hand: Math.max(0, Math.floor(qtyOnHand)) })
    .eq("variant_id", variantId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/inventory");
}

export async function setProductStatus(productId: string, status: "draft" | "active" | "archived") {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("products").update({ status }).eq("id", productId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}

export async function stampInvoice(orderId: string) {
  await requireAdmin(); // critical: stampOrderCfdi uses the service-role client (bypasses RLS)
  const result = await stampOrderCfdi(orderId);
  revalidatePath(`/admin/orders/${orderId}`);
  return result;
}
