"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { stampOrderCfdi } from "@/lib/cfdi";
import { sendShippedEmail } from "@/lib/email";

type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

// Server actions are publicly invocable by any authenticated client, so every
// admin action verifies is_admin() — UI gating is not access control.
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
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
