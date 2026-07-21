import "server-only";

// Minimal Conekta REST wrapper. Amounts in centavos, currency MXN.
// Docs: https://developers.conekta.com  — API version pinned via Accept header.
const BASE = "https://api.conekta.io";
const API_VERSION = "application/vnd.conekta-v2.1.0+json";

function authHeader() {
  const key = process.env.CONEKTA_PRIVATE_KEY;
  if (!key) throw new Error("CONEKTA_PRIVATE_KEY missing");
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

async function conekta<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: authHeader(),
      Accept: API_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    // Conekta ships a buyer-facing Spanish string; prefer it over the raw dump so
    // the checkout can show something actionable. Full payload goes to the logs.
    console.error(`[conekta] ${res.status} ${path}:`, JSON.stringify(body).slice(0, 800));
    const d = body?.details?.[0];
    const buyer: string | undefined = d?.message_to_purchaser ?? d?.message;
    throw new Error(buyer ?? `conekta ${res.status}`);
  }
  return body as T;
}

export type ConektaMethod = "card" | "oxxo" | "spei" | "aplazo";

type LineItem = { name: string; unit_price: number; quantity: number };

type CreateArgs = {
  amountCents: number;       // total (IVA-inclusive) in centavos
  method: ConektaMethod;
  customer: { name: string; email: string; phone: string };
  lineItems: LineItem[];
  discountCents?: number;    // coupon/combo discount -> Conekta discount_lines
  cardTokenId?: string;      // required for card (from Conekta.js on the client)
  orderNumber: string;       // our reference -> Conekta metadata
  expiresAt?: number;        // unix seconds, for oxxo/spei voucher expiry
  returnUrl?: string;        // 3DS return URL (card) / success URL (aplazo)
  cancelUrl?: string;        // aplazo cancel/failure URL
};

export type ConektaCharge = {
  id: string;
  status?: string;
  payment_method: {
    type: string;
    // OXXO (type "cash")
    reference?: string;
    barcode_url?: string;
    // SPEI
    receiving_account_number?: string;  // CLABE to transfer to
    receiving_account_bank?: string;
    expires_at?: number;
    // Aplazo (type "bnpl") — BNPL puts its approval URL here, not in next_action
    redirect_url?: string;
  };
};

export type ConektaOrder = {
  id: string;
  payment_status: string;     // 'paid' | 'pending_payment' | 'declined' | ...
  amount: number;
  charges: { data: ConektaCharge[] };
  // 3DS challenge redirect (card): present when authentication is required
  next_action?: { type?: string; redirect_to_url?: { url?: string; return_url?: string } };
};

function paymentMethodBlock(a: CreateArgs) {
  switch (a.method) {
    case "card":
      if (!a.cardTokenId) throw new Error("cardTokenId required for card payments");
      return { type: "card", token_id: a.cardTokenId };
    case "oxxo":
      return { type: "cash", expires_at: a.expiresAt }; // OXXO = cash
    case "spei":
      return { type: "spei", expires_at: a.expiresAt };
    case "aplazo": // BNPL — redirect to Aplazo to approve installments
      return {
        type: "bnpl",
        product_type: "aplazo_bnpl",
        success_url: a.returnUrl,
        failure_url: a.cancelUrl,
        cancel_url: a.cancelUrl,
      };
  }
}

export async function createConektaOrder(a: CreateArgs): Promise<ConektaOrder> {
  const body: Record<string, unknown> = {
    currency: "MXN",
    customer_info: { name: a.customer.name, email: a.customer.email, phone: a.customer.phone },
    line_items: a.lineItems.map((li) => ({ name: li.name, unit_price: li.unit_price, quantity: li.quantity })),
    charges: [{ payment_method: paymentMethodBlock(a) }],
    metadata: { order_number: a.orderNumber },
  };

  // Conekta charges the sum of line_items minus discount_lines — it ignores any
  // total we'd send — so the discount has to travel as its own line.
  if (a.discountCents && a.discountCents > 0) {
    body.discount_lines = [{ code: "descuento", type: "coupon", amount: a.discountCents }];
  }

  // card requires 3DS2; Conekta returns a challenge redirect when needed
  if (a.method === "card") {
    body.three_ds_mode = "smart";
    if (a.returnUrl) body.return_url = a.returnUrl;
  }

  return conekta<ConektaOrder>("/orders", { method: "POST", body: JSON.stringify(body) });
}

// Re-fetch to confirm real status before committing stock (webhook anti-spoof).
export async function getConektaOrder(orderId: string): Promise<ConektaOrder> {
  return conekta<ConektaOrder>(`/orders/${orderId}`);
}
