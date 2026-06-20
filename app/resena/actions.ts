"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Submit a verified-buyer review. Proof of purchase = the per-order review_token
// (emailed to the buyer). Service-role: validates token -> order -> product in order.
export async function submitReview(input: {
  token: string;
  productId: string;
  rating: number;
  body: string;
  fit: "" | "runs_small" | "true_to_size" | "runs_large";
}): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, customer_id, status")
    .eq("review_token", input.token)
    .maybeSingle();
  if (!order) return { error: "Enlace inválido." };
  if (order.status !== "paid" && order.status !== "fulfilled") {
    return { error: "El pedido aún no está confirmado." };
  }

  // product must belong to the order
  const { data: items } = await admin
    .from("order_items")
    .select("variants(product_id, products(slug))")
    .eq("order_id", order.id);
  type Row = { variants: { product_id: string; products: { slug: string } | null } | null };
  const rows = (items ?? []) as unknown as Row[];
  const match = rows.find((r) => r.variants?.product_id === input.productId);
  if (!match) return { error: "Ese producto no está en tu pedido." };

  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  const { error } = await admin.from("reviews").upsert(
    {
      order_id: order.id,
      product_id: input.productId,
      customer_id: order.customer_id,
      rating,
      body: input.body.trim() || null,
      fit_feedback: input.fit || null,
      verified_purchase: true,
    },
    { onConflict: "order_id,product_id" },
  );
  if (error) return { error: error.message };

  const slug = match.variants?.products?.slug;
  if (slug) revalidatePath(`/products/${slug}`);
  return { ok: true };
}
