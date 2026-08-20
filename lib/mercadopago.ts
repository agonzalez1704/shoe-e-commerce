import "server-only";

import { activeBrand } from "@/lib/brand";

// The name a buyer sees on the checkout line and on the bank statement. It was
// hardcoded to "CALZADO BLADE", so a second store's customers would have been
// charged under another company's name — a chargeback waiting to happen.
// MercadoPago caps statement_descriptor at 16 chars and rejects accents.
const DESCRIPTOR = activeBrand.name
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toUpperCase().slice(0, 16);

// Minimal MercadoPago REST wrapper for Checkout Pro (hosted redirect). Amounts
// in centavos internally; MP wants pesos. Docs: https://www.mercadopago.com.mx/developers
const BASE = "https://api.mercadopago.com";

function token() {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new Error("MERCADOPAGO_ACCESS_TOKEN missing");
  return t;
}

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`[mercadopago] ${res.status} ${path}:`, JSON.stringify(body).slice(0, 800));
    throw new Error(body?.message ?? `mercadopago ${res.status}`);
  }
  return body as T;
}

type PreferenceArgs = {
  orderNumber: string;
  amountCents: number;       // final total the buyer pays (discount already applied)
  itemsSummary: string;      // e.g. "2 artículos" — shown on the MP checkout line
  customer: { name: string; email: string };
  // Datos extra del pagador. El motor de riesgo de MP aprueba mas cuando la
  // preferencia trae telefono y direccion que cuadran con el comprador
  // (rechazos rejected_high_risk con datos minimos — caso BL-001085).
  ship?: { phone?: string; zip?: string; street?: string };
  successUrl: string;
  failureUrl: string;
  notificationUrl: string;
};

export type MpPreference = { id: string; init_point: string; sandbox_init_point?: string };

// One summary line priced at the final total. MercadoPago has no discount-line
// concept — it just sums the items — so a single line is the only way to
// guarantee the charge equals our computed total (coupon/combo already baked in).
export async function createMpPreference(a: PreferenceArgs): Promise<MpPreference> {
  return mp<MpPreference>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          title: `${activeBrand.name} · Pedido ${a.orderNumber}`,
          description: a.itemsSummary,
          quantity: 1,
          unit_price: a.amountCents / 100,
          currency_id: "MXN",
        },
      ],
      external_reference: a.orderNumber, // how the webhook maps a payment back to our order
      payer: {
        name: a.customer.name,
        email: a.customer.email,
        ...(a.ship?.phone ? { phone: { number: a.ship.phone.replace(/\D/g, "") } } : {}),
        ...(a.ship?.zip || a.ship?.street
          ? { address: { ...(a.ship.zip ? { zip_code: a.ship.zip } : {}), ...(a.ship.street ? { street_name: a.ship.street } : {}) } }
          : {}),
      },
      back_urls: { success: a.successUrl, failure: a.failureUrl, pending: a.successUrl },
      auto_return: "approved",
      notification_url: a.notificationUrl,
      statement_descriptor: DESCRIPTOR,
    }),
  });
}

export type MpPayment = {
  id: number;
  status: string;             // 'approved' | 'pending' | 'rejected' | ...
  external_reference?: string; // our order_number
  transaction_amount?: number;
};

// Anti-spoof: the webhook re-fetches the payment straight from MP before we ever
// commit stock. Never trust the notification body alone.
export async function getMpPayment(id: string): Promise<MpPayment> {
  return mp<MpPayment>(`/v1/payments/${id}`);
}
