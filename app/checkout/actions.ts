"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConektaOrder, type ConektaMethod } from "@/lib/conekta";
import { sendVoucherEmail, sendPaidEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/site";

// flat shipping: 199 MXN, free over 1,500 MXN (centavos)
function shippingFor(subtotalMinusDiscount: number) {
  return subtotalMinusDiscount >= 150_000 ? 0 : 19_900;
}

export type FiscalInput = {
  rfc: string;
  fiscal_name: string;
  fiscal_regime: string;
  cfdi_use: string;
  postal_code: string;
  email: string;
};

export type CheckoutInput = {
  cartId: string;
  email: string;
  method: ConektaMethod;
  customerName: string;
  phone?: string;
  shippingAddress: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  discountCode?: string;
  cardTokenId?: string;            // card only, from Conekta.js
  fiscal?: FiscalInput;            // present when buyer wants a CFDI
};

export type CheckoutResult = {
  orderNumber: string;
  method: ConektaMethod;
  totalCents: number;
  expiresAt: string | null;
  // method-specific instructions for the confirmation screen:
  oxxo?: { reference: string; voucherUrl?: string };
  spei?: { clabe: string; bank?: string };
  card?: { paid: boolean };
  redirectUrl?: string; // card 3DS or Aplazo BNPL approval
};

export type CheckoutError = { error: string };

// Next masks thrown server-action errors in production ("a digest property is
// included..."), which is useless to a buyer. So every failure comes back as a
// returned message: known causes get actionable Spanish, the rest a generic
// line, and the real detail is logged for us.
export async function checkout(input: CheckoutInput): Promise<CheckoutResult | CheckoutError> {
  try {
    return await runCheckout(input);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("[checkout] failed:", raw);
    return { error: buyerMessage(raw) };
  }
}

// Messages we author (Spanish, already actionable) pass through; anything that
// smells like an internal failure is replaced.
function buyerMessage(raw: string): string {
  if (/discount code/i.test(raw)) return "El código de descuento no es válido o ya venció.";
  if (/out of stock|sin stock/i.test(raw)) return "Un artículo de tu carrito ya no está disponible.";
  if (/cart .* not found|cart is empty/i.test(raw)) return "Tu carrito expiró. Vuelve a agregar tus productos.";
  // our own Spanish strings + Conekta's buyer-facing messages are safe to show
  if (/^[^{}]*[áéíóúñ¿¡]/i.test(raw) && raw.length < 200) return raw;
  return "No pudimos procesar tu pago. Verifica tus datos o intenta con otro método.";
}

async function runCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  // abuse guard: 10 checkout attempts / minute / IP (layered with the pending-order cap)
  const ip = await clientIp();
  if (!(await rateLimit("checkout", ip, 10, 60))) {
    throw new Error("Demasiados intentos. Espera un momento e intenta de nuevo.");
  }

  const supabase = await createClient();   // user JWT -> RLS
  const admin = createAdminClient();       // service role -> trusted RPCs

  // 1. create order from cart (reserves stock, sets method + expiry + IVA)
  const { data: created, error: createErr } = await supabase
    .rpc("create_order", {
      p_cart_id: input.cartId,
      p_email: input.email,
      p_payment_method: input.method,
      p_shipping: input.shippingAddress as never,
      p_billing: (input.billingAddress ?? input.shippingAddress) as never,
      // codes are stored upper-cased; create_order matches exactly
      p_discount_code: input.discountCode?.trim().toUpperCase() || undefined,
      p_needs_invoice: !!input.fiscal,
    })
    .single();
  if (createErr || !created) {
    const msg = createErr?.message ?? "create_order failed";
    // surface the one error a buyer can actually fix, in Spanish
    throw new Error(/discount code/i.test(msg) ? "El código de descuento no es válido o ya venció." : msg);
  }

  const orderId = created.order_id;
  const baseAfterDiscount = created.subtotal_cents - created.discount_cents;

  // 2. add shipping, recompute totals (service role)
  const shipping = shippingFor(baseAfterDiscount);
  await admin.rpc("set_order_amounts", { p_order_id: orderId, p_shipping_cents: shipping });
  const totalCents = baseAfterDiscount + shipping;

  // 3. persist fiscal data if invoice requested (RLS: user owns order)
  if (input.fiscal) {
    const { error } = await supabase.from("order_fiscal_data").insert({
      order_id: orderId,
      ...input.fiscal,
    });
    if (error) throw new Error(`fiscal data: ${error.message}`);
  }

  // 4. line items for the Conekta voucher
  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, variant_label, unit_price_cents, quantity")
    .eq("order_id", orderId);

  const lineItems = (items ?? []).map((i) => ({
    name: `${i.product_name} (${i.variant_label})`,
    unit_price: i.unit_price_cents,
    quantity: i.quantity,
  }));
  if (shipping > 0) lineItems.push({ name: "Envío", unit_price: shipping, quantity: 1 });

  const expiresUnix = created.expires_at
    ? Math.floor(new Date(created.expires_at).getTime() / 1000)
    : undefined;

  // 5. create the Conekta order/charge
  const co = await createConektaOrder({
    amountCents: totalCents,
    method: input.method,
    customer: { name: input.customerName, email: input.email, phone: input.phone ?? "" },
    lineItems,
    cardTokenId: input.cardTokenId,
    orderNumber: created.order_number,
    expiresAt: expiresUnix,
    returnUrl: `${SITE_URL}/checkout/gracias?o=${created.order_number}`,
    cancelUrl: `${SITE_URL}/checkout?pago=cancelado`,
  });

  const charge = co.charges.data[0];
  const pm = charge.payment_method;
  const reference = pm.reference;                 // OXXO
  const voucherUrl = pm.barcode_url;              // OXXO barcode image
  const clabe = pm.receiving_account_number;      // SPEI
  const bank = pm.receiving_account_bank;         // SPEI
  // redirect to provider — card 3DS challenge OR Aplazo approval
  const redirectUrl = co.next_action?.redirect_to_url?.url;

  // 6. record the pending payment + voucher details (service role)
  await admin.rpc("record_payment", {
    p_order_id: orderId,
    p_provider_charge_id: co.id,
    p_method: input.method,
    p_amount_cents: totalCents,
    p_reference: reference ?? undefined,
    p_clabe: clabe ?? undefined,
    p_voucher_url: voucherUrl ?? undefined,
    p_expires_at: pm.expires_at ? new Date(pm.expires_at * 1000).toISOString() : undefined,
  });

  // 7. card without 3DS (risk-free smart mode) may already be paid — commit now
  //    (webhook also fires, idempotent). With 3DS, the webhook commits after the challenge.
  let cardPaid = false;
  if (input.method === "card" && co.payment_status === "paid" && !redirectUrl) {
    await admin.rpc("commit_order", {
      p_order_id: orderId,
      p_charge_id: co.id,
      p_amount_cents: totalCents,
      p_method: "card",
    });
    cardPaid = true;
  }

  // 8. notify the buyer (non-fatal). Skip card emails until payment confirms (webhook handles it).
  const emailLines = (items ?? []).map((i) => ({
    name: `${i.product_name} (${i.variant_label})`,
    quantity: i.quantity,
    lineTotalCents: i.unit_price_cents * i.quantity,
  }));
  const breakdown = {
    subtotalCents: created.subtotal_cents,
    discountCents: created.discount_cents,
    shippingCents: shipping,
    taxCents: Math.round((totalCents * 16) / 116), // IVA-inclusive of the final total
  };

  if (cardPaid) {
    await sendPaidEmail({ to: input.email, orderNumber: created.order_number, totalCents, lines: emailLines, breakdown });
  } else if (input.method === "oxxo" || input.method === "spei") {
    await sendVoucherEmail({
      to: input.email,
      orderNumber: created.order_number,
      totalCents,
      method: input.method,
      reference: reference ?? undefined,
      clabe: clabe ?? undefined,
      bank: bank ?? undefined,
      voucherUrl: voucherUrl ?? undefined,
      expiresAt: created.expires_at,
      lines: emailLines,
      breakdown,
    });
  }

  return {
    orderNumber: created.order_number,
    method: input.method,
    totalCents,
    expiresAt: created.expires_at,
    redirectUrl, // card 3DS / Aplazo — client redirects here if present
    oxxo: input.method === "oxxo" ? { reference: reference ?? "", voucherUrl } : undefined,
    spei: input.method === "spei" ? { clabe: clabe ?? "", bank } : undefined,
    card: input.method === "card" ? { paid: cardPaid } : undefined,
  };
}
