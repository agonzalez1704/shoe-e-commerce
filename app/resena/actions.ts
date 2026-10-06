"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { crearCodigoUnico } from "@/lib/codigos";
import { sendReviewCouponEmail } from "@/lib/email";
import { CUPON_RESENA } from "@/lib/reviews";

// Entrada sin el link del correo: numero de pedido + correo de la compra (solo
// el numero, que es consecutivo, dejaria reseñar pedidos ajenos). Solo pedidos
// entregados; el resto se queda en el formulario con el motivo.
export type AccesoResena = { error: string; o: string; e: string } | null;

export async function entrarAResena(_prev: AccesoResena, form: FormData): Promise<AccesoResena> {
  const o = String(form.get("o") ?? "").trim().toUpperCase();
  const e = String(form.get("e") ?? "").trim();
  // React vacia el formulario tras la accion: se devuelven los valores para rellenarlo.
  const falla = (error: string) => ({ error, o, e });
  if (!(await rateLimit("resena-acceso", await clientIp(), 10, 3600))) {
    return falla("Demasiados intentos. Intenta de nuevo en una hora.");
  }
  if (!o || !e) return falla("Escribe tu número de pedido y tu correo.");

  const { data: order } = await createAdminClient()
    .from("orders")
    .select("review_token, status, delivered_at")
    .eq("order_number", o)
    .ilike("email", e.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (!order?.review_token || order.status === "cancelled" || order.status === "refunded") {
    return falla("No encontramos un pedido con ese número y correo.");
  }
  if (!order.delivered_at) return falla("Podrás dejar tu reseña en cuanto tu pedido se entregue.");
  redirect(`/resena/${order.review_token}`);
}

// Submit a verified-buyer review. Proof of purchase = the per-order review_token
// (emailed to the buyer). Service-role: validates token -> order -> product in order.
export async function submitReview(input: {
  token: string;
  productId: string;
  rating: number;
  body: string;
  fit: "" | "runs_small" | "true_to_size" | "runs_large";
}): Promise<{ ok: true; cupon: { codigo: string; porcentaje: number; dias: number } | null } | { error: string }> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, customer_id, status, delivered_at, email, order_number, cupon_resena")
    .eq("review_token", input.token)
    .maybeSingle();
  if (!order) return { error: "Enlace inválido." };
  if (!order.delivered_at || (order.status !== "paid" && order.status !== "fulfilled")) {
    return { error: "Podrás dejar tu reseña en cuanto tu pedido se entregue." };
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
  const codigo = await cuponDeResena(admin, order);
  return { ok: true, cupon: codigo ? { codigo, ...CUPON_RESENA } : null };
}

// Agradecimiento por reseñar, cualquiera que sea la calificacion: un cupon por
// pedido. El update condicional evita dos cupones si llegan dos reseñas a la vez.
async function cuponDeResena(
  admin: ReturnType<typeof createAdminClient>,
  order: { id: string; email: string; order_number: string; cupon_resena: string | null },
): Promise<string | null> {
  if (order.cupon_resena) return order.cupon_resena;
  const code = await crearCodigoUnico(admin, "GRACIAS", CUPON_RESENA.porcentaje, CUPON_RESENA.dias * 24);
  if (!code) return null;
  const { data: tomado } = await admin
    .from("orders")
    .update({ cupon_resena: code })
    .eq("id", order.id)
    .is("cupon_resena", null)
    .select("id");
  if (!tomado?.length) {
    await admin.from("discount_codes").update({ active: false }).eq("code", code);
    const { data } = await admin.from("orders").select("cupon_resena").eq("id", order.id).single();
    return data?.cupon_resena ?? null;
  }
  await sendReviewCouponEmail({ to: order.email, orderNumber: order.order_number, codigo: code });
  return code;
}
