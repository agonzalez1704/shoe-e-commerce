"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type TrackedOrder = {
  orderNumber: string;
  status: string;
  paymentMethod: string | null;
  totalCents: number;
  createdAt: string;
  items: { name: string; quantity: number }[];
  payment: { status: string; reference: string | null; clabe: string | null; voucherUrl: string | null } | null;
};

// Guest order lookup by order number + email (both required = anti-enumeration).
export async function lookupOrder(
  orderNumber: string,
  email: string,
): Promise<{ order: TrackedOrder } | { error: string }> {
  const ip = await clientIp();
  if (!(await rateLimit("track", ip, 20, 60))) {
    return { error: "Demasiados intentos. Espera un momento." };
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, status, payment_method, total_cents, created_at")
    .eq("order_number", orderNumber.trim().toUpperCase())
    .ilike("email", email.trim())
    .maybeSingle();

  if (!order) return { error: "No encontramos ese pedido. Verifica el número y el correo." };

  const [{ data: items }, { data: payment }] = await Promise.all([
    admin.from("order_items").select("product_name, variant_label, quantity").eq("order_id", order.id),
    admin
      .from("payments")
      .select("status, reference, clabe, voucher_url")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    order: {
      orderNumber: order.order_number,
      status: order.status,
      paymentMethod: order.payment_method,
      totalCents: order.total_cents,
      createdAt: order.created_at,
      items: (items ?? []).map((i) => ({ name: `${i.product_name} (${i.variant_label})`, quantity: i.quantity })),
      payment: payment
        ? { status: payment.status, reference: payment.reference, clabe: payment.clabe, voucherUrl: payment.voucher_url }
        : null,
    },
  };
}
