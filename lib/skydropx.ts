// ============================================================
// Skydropx Pro shipping. One place authenticates (OAuth client_credentials,
// token cached), quotes rates (async → poll), and creates the shipment + label.
// Used by the admin fulfillment panel to generate the guía for an order.
//
// Origin = Blade's warehouse (edit ORIGIN if it changes). Requires env:
//   SKYDROPX_API_KEY, SKYDROPX_SECRET_KEY  (add them to Vercel too).
// ============================================================

const BASE = "https://pro.skydropx.com/api/v1";

// Blade warehouse. Postal code confirmed 37000 by the owner (drives the quote).
export const ORIGIN = {
  name: "Blade",
  company: "Blade",
  phone: "4773791352",
  email: "pedidos@calzadoblade.com",
  street1: "Tres Guerras 213-B",
  area_level1: "Guanajuato", // estado
  area_level2: "León", // municipio
  area_level3: "Obregón", // colonia
  postal_code: "37000",
  country_code: "MX",
  reference: "",
};

export const PARCEL = { length: 32, width: 22, height: 12, weight: 1.2 }; // cm / kg

export type Address = {
  name: string;
  phone: string;
  email: string;
  street1: string;
  area_level1: string; // estado
  area_level2: string; // municipio / ciudad
  area_level3: string; // colonia
  postal_code: string;
  country_code?: string;
  reference?: string;
};

export type Rate = {
  id: string;
  provider_name: string;
  service: string | null;
  total: number;
  days: number | null;
};

export type ShipmentResult = {
  carrier: string; // maps to our carrier keys where possible
  trackingNumber: string;
  trackingUrl: string | null;
  labelUrl: string | null;
};

let cachedToken: { value: string; exp: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 30_000) return cachedToken.value;
  const id = process.env.SKYDROPX_API_KEY;
  const secret = process.env.SKYDROPX_SECRET_KEY;
  if (!id || !secret) throw new Error("Skydropx no configurado (faltan SKYDROPX_API_KEY / SKYDROPX_SECRET_KEY)");
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("Skydropx auth falló");
  cachedToken = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

async function api(path: string, init: RequestInit = {}) {
  const t = await token();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Skydropx ${path}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

const addrPayload = (a: Address) => ({
  country_code: a.country_code ?? "MX",
  postal_code: a.postal_code,
  area_level1: a.area_level1,
  area_level2: a.area_level2,
  area_level3: a.area_level3,
  name: a.name,
  phone: a.phone,
  email: a.email,
  street1: a.street1,
  reference: a.reference ?? "",
});

// Create a quotation and poll until the rates resolve. Returns successful rates
// cheapest-first + the quotation id.
export async function quote(to: Address): Promise<{ quotationId: string; rates: Rate[] }> {
  const created = await api("/quotations", {
    method: "POST",
    body: JSON.stringify({
      quotation: {
        address_from: addrPayload({ ...ORIGIN } as Address),
        address_to: addrPayload(to),
        parcels: [PARCEL],
      },
    }),
  });
  const quotationId: string = created.id;

  let data = created;
  for (let i = 0; i < 8 && !data.is_completed; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    data = await api(`/quotations/${quotationId}`);
  }

  const rates: Rate[] = (data.rates ?? [])
    .filter((r: { success?: boolean; total?: string | number }) => r.success && r.total != null)
    .map((r: { id: string; provider_name: string; provider_service_level_name: string | null; total: string; days: number | null }) => ({
      id: r.id,
      provider_name: r.provider_name,
      service: r.provider_service_level_name,
      total: Number(r.total),
      days: r.days,
    }))
    .sort((a: Rate, b: Rate) => a.total - b.total);

  return { quotationId, rates };
}

// Create the shipment for a chosen rate → tracking + label PDF.
export async function createShipment(quotationId: string, rate: Rate, to: Address): Promise<ShipmentResult> {
  const j = await api("/shipments", {
    method: "POST",
    body: JSON.stringify({
      shipment: {
        quotation_id: quotationId,
        rate_id: rate.id,
        carrier_name: rate.provider_name,
        address_from: addrPayload({ ...ORIGIN } as Address),
        address_to: addrPayload(to),
        parcels: [PARCEL],
      },
    }),
  });

  const d = j.data ?? j;
  const labelUrl: string | null = d.label_urls?.[0] ?? d.label_url ?? null;
  const trackingNumber: string = d.tracking_number ?? d.master_tracking_number ?? "";
  const trackingUrl: string | null = d.tracking_url ?? d.tracking_url_provider ?? null;
  return { carrier: rate.provider_name, trackingNumber, trackingUrl, labelUrl };
}

// One-shot: quote → cheapest rate → shipment. Throws if no rates.
export async function generateLabel(to: Address): Promise<ShipmentResult> {
  const { quotationId, rates } = await quote(to);
  if (!rates.length) throw new Error("Skydropx: sin tarifas disponibles para esta dirección");
  return createShipment(quotationId, rates[0], to);
}
