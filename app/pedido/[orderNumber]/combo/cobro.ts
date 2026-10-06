"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createConektaOrder, type ConektaMethod } from "@/lib/conekta";
import { markOrderPaid } from "@/lib/order-fulfillment";
import { SITE_URL } from "@/lib/site";
import { redirect } from "next/navigation";
import { restoreCartFromOrder } from "@/app/cart/actions";
import { pedidoAutorizado } from "./actions";

// Cobra cualquier pedido pendiente con los MISMOS metodos del checkout:
// tarjeta y Aplazo van por Conekta (esta funcion); Mercado Pago sigue en
// /pagar. Lo usan el complemento del combo y el pedido normal cuando el primer
// intento fallo (antes no habia como cambiar de metodo ni cancelar).

export type ResultadoCobro =
  | { ok: true; paid: true }
  | { ok: true; paid: false; redirectUrl?: string; voucher?: { reference: string | null; barcodeUrl: string | null; expiresAt: string | null } }
  | { ok: false; error: string };

type Pendiente = {
  id: string; order_number: string; email: string; total_cents: number;
  shipping_address: unknown; expires_at: string | null;
};
const COLUMNAS = "id, order_number, status, email, total_cents, shipping_address, expires_at";

export async function pagarComplemento(
  parentOrderNumber: string,
  token: string | null,
  method: ConektaMethod,
  cardTokenId?: string,
): Promise<ResultadoCobro> {
  const padre = await pedidoAutorizado(parentOrderNumber, token);
  if (!padre) return { ok: false, error: "No pudimos verificar tu pedido." };
  const { data: hijo } = await createAdminClient()
    .from("orders")
    .select(COLUMNAS)
    .eq("combo_parent_order_id", padre.id)
    .eq("status", "pending")
    .maybeSingle();
  if (!hijo) return { ok: false, error: "No hay un complemento pendiente de pago." };
  return cobrar(hijo, method, cardTokenId);
}

export async function pagarPedido(
  orderNumber: string,
  token: string | null,
  method: ConektaMethod,
  cardTokenId?: string,
): Promise<ResultadoCobro> {
  const pedido = await pedidoAutorizado(orderNumber, token);
  if (!pedido) return { ok: false, error: "No pudimos verificar tu pedido." };
  const { data } = await createAdminClient().from("orders").select(COLUMNAS).eq("id", pedido.id).maybeSingle();
  if (!data || data.status !== "pending") return { ok: false, error: "Este pedido ya no está pendiente de pago." };
  return cobrar(data, method, cardTokenId);
}

// Cancela el pedido pendiente (libera el stock) y regresa sus pares al
// carrito de este navegador para que pueda volver a comprar.
export async function cancelarPedido(orderNumber: string, token: string | null): Promise<{ ok: false; error: string }> {
  const pedido = await pedidoAutorizado(orderNumber, token);
  if (!pedido) return { ok: false, error: "No pudimos verificar tu pedido." };
  if (pedido.status !== "pending") return { ok: false, error: "Este pedido ya no se puede cancelar desde aquí; escríbenos por WhatsApp." };
  await restoreCartFromOrder(pedido.id);
  redirect("/cart");
}

async function cobrar(hijo: Pendiente, method: ConektaMethod, cardTokenId?: string): Promise<ResultadoCobro> {
  try {
    const admin = createAdminClient();
    if (method === "card" && !cardTokenId) return { ok: false, error: "Falta el token de la tarjeta." };
    if (method === "oxxo") return { ok: false, error: "El pago en efectivo ya no está disponible. Elige tarjeta o Aplazo." };

    const ship = (hijo.shipping_address ?? {}) as Record<string, string>;
    const { data: items } = await admin
      .from("order_items")
      .select("product_name, variant_label, unit_price_cents, quantity")
      .eq("order_id", hijo.id);

    const co = await createConektaOrder({
      amountCents: hijo.total_cents,
      method,
      customer: { name: ship.name || "Cliente", email: hijo.email, phone: ship.phone || "" },
      lineItems: (items ?? []).map((i) => ({
        name: `${i.product_name} (${i.variant_label})`,
        unit_price: i.unit_price_cents,
        quantity: i.quantity,
      })),
      discountCents: 0,
      cardTokenId,
      orderNumber: hijo.order_number,
      expiresAt: hijo.expires_at ? Math.floor(new Date(hijo.expires_at).getTime() / 1000) : undefined,
      returnUrl: `${SITE_URL}/checkout/gracias?o=${hijo.order_number}`,
      cancelUrl: `${SITE_URL}/checkout/gracias?o=${hijo.order_number}&payment_status=failed`,
    });

    const charge = co.charges.data[0];
    const pm = charge.payment_method;
    const redirectUrl = co.next_action?.redirect_to_url?.url ?? pm.redirect_url;

    // El metodo elegido queda en el pedido (nacio como mercadopago en el RPC).
    await admin.from("orders").update({ payment_method: method }).eq("id", hijo.id);
    await admin.rpc("record_payment", {
      p_order_id: hijo.id,
      p_provider_charge_id: co.id,
      p_method: method,
      p_amount_cents: hijo.total_cents,
      p_reference: pm.reference ?? undefined,
      p_clabe: pm.receiving_account_number ?? undefined,
      p_voucher_url: pm.barcode_url ?? undefined,
      p_expires_at: pm.expires_at ? new Date(pm.expires_at * 1000).toISOString() : undefined,
    });

    // Tarjeta sin 3DS: pagado ya — markOrderPaid trae correo, pixel, push y su
    // candado anti-duplicados (el webhook tambien dispara, idempotente).
    if (method === "card" && co.payment_status === "paid" && !redirectUrl) {
      await markOrderPaid({ orderId: hijo.id, chargeId: co.id, amountCents: hijo.total_cents, method: "card" });
      return { ok: true, paid: true };
    }

    return {
      ok: true,
      paid: false,
      redirectUrl: redirectUrl ?? undefined,
      voucher: pm.reference || pm.barcode_url
        ? { reference: pm.reference ?? null, barcodeUrl: pm.barcode_url ?? null, expiresAt: hijo.expires_at }
        : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo procesar el pago" };
  }
}
