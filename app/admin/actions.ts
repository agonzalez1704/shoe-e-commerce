"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { stampOrderCfdi } from "@/lib/cfdi";

type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

// Server actions are publicly invocable by any authenticated client, so every
// admin action verifies is_admin() — UI gating is not access control.
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw new Error(error.message);
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
