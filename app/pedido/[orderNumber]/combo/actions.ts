"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Autoriza el acceso al combo exprés de un pedido: o traes el token del
// pedido (la liga del correo) o eres el dueño con sesión. Devuelve el pedido
// o null; nunca lanza — la página decide qué mostrar.
export async function pedidoAutorizado(orderNumber: string, token: string | null) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, status, email, review_token, customer_id, total_cents")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order) return null;

  if (token && order.review_token && token === order.review_token) return order;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && order.customer_id === user.id) return order;
  return null;
}

export async function elegirComplemento(orderNumber: string, token: string | null, variantId: string) {
  const order = await pedidoAutorizado(orderNumber, token);
  if (!order) return { ok: false as const, error: "No pudimos verificar tu pedido. Abre la liga de tu correo o inicia sesión." };

  const admin = createAdminClient();
  // El RPC es la verdad: recalcula elegibilidad y diferencia contra la base;
  // del navegador solo viaja QUÉ variante quiere. Idempotente: si ya hay un
  // complemento vivo, devuelve ese en vez de crear otro.
  const { data, error } = await admin.rpc("crear_pedido_complemento", {
    p_parent_order_id: order.id,
    p_variant_id: variantId,
  });
  if (error) return { ok: false as const, error: error.message };
  const num = (data as { out_order_number: string }[] | null)?.[0]?.out_order_number;
  if (!num) return { ok: false as const, error: "No se pudo crear el pedido del combo." };

  // El pago vive en el flujo que ya existe: /pagar rebota a Mercado Pago
  // (tarjeta, saldo o meses) y el webhook confirma como cualquier pedido.
  redirect(`/pedido/${num}/pagar`);
}
