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
  card?: { paid: boolean; redirectUrl?: string };
};

export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
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
      p_discount_code: input.discountCode ?? undefined,
      p_needs_invoice: !!input.fiscal,
    })
    .single();
  if (createErr || !created) throw new Error(createErr?.message ?? "create_order failed");

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
  });

  const charge = co.charges.data[0];
  const pm = charge.payment_method;
  const reference = pm.reference;                 // OXXO
  const voucherUrl = pm.barcode_url;              // OXXO barcode image
  const clabe = pm.receiving_account_number;      // SPEI
  const bank = pm.receiving_account_bank;         // SPEI
  const threeDsUrl = co.next_action?.redirect_to_url?.url; // card 3DS challenge

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
  if (input.method === "card" && co.payment_status === "paid" && !threeDsUrl) {
    await admin.rpc("commit_order", {
      p_order_id: orderId,
      p_charge_id: co.id,
      p_amount_cents: totalCents,
      p_method: "card",
    });
    cardPaid = true;
  }

  // 8. notify the buyer (non-fatal). Skip card emails until payment confirms (webhook handles it).
  if (cardPaid) {
    await sendPaidEmail({ to: input.email, orderNumber: created.order_number, totalCents });
  } else if (input.method === "oxxo" || input.method === "spei") {
    await sendVoucherEmail({
      to: input.email,
      orderNumber: created.order_number,
      totalCents,
      method: input.method,
      reference: reference ?? undefined,
      clabe: clabe ?? undefined,
      voucherUrl: voucherUrl ?? undefined,
      expiresAt: created.expires_at,
    });
  }

  return {
    orderNumber: created.order_number,
    method: input.method,
    totalCents,
    expiresAt: created.expires_at,
    oxxo: input.method === "oxxo" ? { reference: reference ?? "", voucherUrl } : undefined,
    spei: input.method === "spei" ? { clabe: clabe ?? "", bank } : undefined,
    card: input.method === "card" ? { paid: cardPaid, redirectUrl: threeDsUrl } : undefined,
  };
}
