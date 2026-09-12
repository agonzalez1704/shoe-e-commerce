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

  // De vuelta a la pagina del combo: con el complemento pendiente creado, ahi
  // vive el paso de pago con TODOS los metodos del checkout.
  redirect(`/pedido/${orderNumber}/combo${token ? `?t=${encodeURIComponent(token)}` : ""}`);
}

// El cliente cambio de opinion antes de pagar: se cancela el complemento
// pendiente y vuelve a la reja. Solo si NO se genero ya una ficha de pago —
// una ficha viva podria pagarse en tienda contra un pedido cancelado.
export async function cambiarPar(orderNumber: string, token: string | null) {
  const order = await pedidoAutorizado(orderNumber, token);
  if (!order) return { ok: false as const, error: "No pudimos verificar tu pedido." };
  const admin = createAdminClient();
  const { data: hijo } = await admin
    .from("orders")
    .select("id, status")
    .eq("combo_parent_order_id", order.id)
    .eq("status", "pending")
    .maybeSingle();
  if (!hijo) return { ok: false as const, error: "No hay un par apartado que cambiar." };
  const { data: pago } = await admin
    .from("payments").select("id").eq("order_id", hijo.id).limit(1).maybeSingle();
  if (pago) return { ok: false as const, error: "Ya se generó una ficha de pago para este par; escríbenos por WhatsApp para cambiarlo." };
  const { error } = await admin.from("orders").update({ status: "cancelled" }).eq("id", hijo.id);
  if (error) return { ok: false as const, error: error.message };
  redirect(`/pedido/${orderNumber}/combo${token ? `?t=${encodeURIComponent(token)}` : ""}`);
}
