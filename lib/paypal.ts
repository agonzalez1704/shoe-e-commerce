import "server-only";

import { activeBrand } from "@/lib/brand";

// PayPal Checkout (Orders v2). Flujo: creamos la orden, el comprador la aprueba
// en PayPal y al volver la capturamos (/api/paypal/return). Si cierra la pestaña
// antes de volver no hay captura: no se cobra nada y el pedido vence solo.
const BASE = process.env.PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

let cached: { value: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.value;
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_SECRET;
  if (!id || !secret) throw new Error("PayPal no configurado (faltan PAYPAL_CLIENT_ID / PAYPAL_SECRET)");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("PayPal auth falló");
  cached = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

async function pp<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

export const paypalEnabled = () => !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);

type PpOrder = {
  id: string;
  status: string; // CREATED | APPROVED | COMPLETED | ...
  links?: { rel: string; href: string }[];
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    payments?: { captures?: { id: string; status: string; custom_id?: string; amount: { value: string; currency_code: string } }[] };
  }[];
  details?: { issue: string; description?: string }[];
  message?: string;
};

export async function createPaypalOrder(a: {
  orderNumber: string;
  amountCents: number;
  description: string;
  email?: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; approveUrl: string }> {
  const { status, body } = await pp<PpOrder>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: a.orderNumber,
          custom_id: a.orderNumber, // con esto la captura se casa con nuestro pedido
          description: `${activeBrand.name} · Pedido ${a.orderNumber} · ${a.description}`.slice(0, 127),
          amount: { currency_code: "MXN", value: (a.amountCents / 100).toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          ...(a.email ? { email_address: a.email } : {}),
          experience_context: {
            brand_name: activeBrand.name.slice(0, 127),
            locale: "es-MX",
            shipping_preference: "NO_SHIPPING", // la direccion ya la capturamos nosotros
            user_action: "PAY_NOW",
            return_url: a.returnUrl,
            cancel_url: a.cancelUrl,
          },
        },
      },
    }),
  });
  const approveUrl = body.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (status >= 300 || !approveUrl) {
    console.error("[paypal] create order:", status, JSON.stringify(body).slice(0, 600));
    throw new Error("No se pudo iniciar el pago con PayPal.");
  }
  return { id: body.id, approveUrl };
}

export type CapturaPaypal =
  | { ok: true; captureId: string; amountCents: number; orderNumber: string | null }
  | { ok: false; reintentar: boolean; error: string };

// Captura idempotente: PayPal-Request-Id fijo por orden, y si ya estaba
// capturada se lee la captura existente en vez de fallar.
export async function capturePaypalOrder(ppOrderId: string): Promise<CapturaPaypal> {
  let { status, body } = await pp<PpOrder>(`/v2/checkout/orders/${encodeURIComponent(ppOrderId)}/capture`, {
    method: "POST",
    headers: { "PayPal-Request-Id": `cap-${ppOrderId}` },
  });
  if (status === 422 && body.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED")) {
    ({ status, body } = await pp<PpOrder>(`/v2/checkout/orders/${encodeURIComponent(ppOrderId)}`));
  }
  const unidad = body.purchase_units?.[0];
  const captura = unidad?.payments?.captures?.[0];
  if (status < 300 && body.status === "COMPLETED" && captura?.status === "COMPLETED") {
    return {
      ok: true,
      captureId: captura.id,
      amountCents: Math.round(Number(captura.amount.value) * 100),
      // en la respuesta de captura el custom_id viene dentro de la captura
      orderNumber: captura.custom_id ?? unidad?.custom_id ?? unidad?.reference_id ?? null,
    };
  }
  const issue = body.details?.[0]?.issue ?? body.status ?? String(status);
  console.error("[paypal] capture:", ppOrderId, status, JSON.stringify(body).slice(0, 600));
  // INSTRUMENT_DECLINED: el comprador puede elegir otra forma de pago en PayPal
  return { ok: false, reintentar: issue === "INSTRUMENT_DECLINED", error: issue };
}
