"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createConektaOrder, type ConektaMethod } from "@/lib/conekta";
import { markOrderPaid } from "@/lib/order-fulfillment";
import { sendVoucherEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { pedidoAutorizado } from "./actions";

// Cobra el pedido complemento con los MISMOS metodos del checkout: tarjeta,
// efectivo en establecimientos y Aplazo van por Conekta (esta funcion);
// Mercado Pago sigue en /pagar. Es un camino paralelo al del checkout — el
// flujo normal de carrito no se toca.

export type ResultadoCobro =
  | { ok: true; paid: true }
  | { ok: true; paid: false; redirectUrl?: string; voucher?: { reference: string | null; barcodeUrl: string | null; expiresAt: string | null } }
  | { ok: false; error: string };

export async function pagarComplemento(
  parentOrderNumber: string,
  token: string | null,
  method: ConektaMethod,
  cardTokenId?: string,
): Promise<ResultadoCobro> {
  try {
    const padre = await pedidoAutorizado(parentOrderNumber, token);
    if (!padre) return { ok: false, error: "No pudimos verificar tu pedido." };

    const admin = createAdminClient();
    const { data: hijo } = await admin
      .from("orders")
      .select("id, order_number, status, email, total_cents, shipping_address, expires_at")
      .eq("combo_parent_order_id", padre.id)
      .eq("status", "pending")
      .maybeSingle();
    if (!hijo) return { ok: false, error: "No hay un complemento pendiente de pago." };
    if (method === "card" && !cardTokenId) return { ok: false, error: "Falta el token de la tarjeta." };

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

    if (method === "oxxo") {
      await sendVoucherEmail({
        to: hijo.email,
        orderNumber: hijo.order_number,
        totalCents: hijo.total_cents,
        method,
        reference: pm.reference ?? undefined,
        voucherUrl: pm.barcode_url ?? undefined,
        expiresAt: hijo.expires_at,
        lines: (items ?? []).map((i) => ({ name: `${i.product_name} (${i.variant_label})`, quantity: i.quantity, lineTotalCents: i.unit_price_cents * i.quantity })),
        breakdown: { subtotalCents: hijo.total_cents, discountCents: 0, shippingCents: 0, taxCents: Math.round((hijo.total_cents * 16) / 116) },
      });
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
