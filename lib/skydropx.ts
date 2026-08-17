// ============================================================
// Skydropx Pro shipping. One place authenticates (OAuth client_credentials,
// token cached), quotes rates (async → poll), and creates the shipment + label.
// Used by the admin fulfillment panel to generate the guía for an order.
//
// Origin = the brand's warehouse (lib/brand.ts). Requires env:
//   SKYDROPX_API_KEY, SKYDROPX_SECRET_KEY  (add them to Vercel too).
// ============================================================

import { activeBrand } from "@/lib/brand";

const BASE = "https://pro.skydropx.com/api/v1";

// Shipping origin comes from the active brand; the postal code drives the quote.
const W = activeBrand.warehouse;

export const ORIGIN = {
  name: W?.name ?? activeBrand.name,
  company: activeBrand.name,
  phone: W?.phone ?? "",
  email: activeBrand.legal.supportEmail,
  street1: W?.street1 ?? "",
  area_level1: W?.state ?? "",          // estado
  area_level2: W?.city ?? "",           // municipio
  area_level3: W?.neighborhood ?? "",   // colonia
  postal_code: W?.postalCode ?? "",
  country_code: "MX",
  reference: "",
};

export const PARCEL = { length: 32, width: 22, height: 12, weight: 1.2 }; // cm / kg

// Carta porte. Skydropx exige ambos al crear el envío — y los quiere a nivel de
// shipment, no dentro del paquete: puestos en el parcel responde que "son
// requeridos en todos los paquetes" aunque vayan ahí.
//   4G = caja de cartón
//
// La clave de producto sale de la marca (o de SKYDROPX_CONSIGNMENT_NOTE para
// afinarla sin tocar código). Estaba fija en 53111600 —calzado—, así que la
// carta porte de una moto eléctrica declaraba zapatos ante el SAT.
export const PACKAGE_TYPE = "4G";
export const CONSIGNMENT_NOTE =
  process.env.SKYDROPX_CONSIGNMENT_NOTE || activeBrand.sat?.consignmentCode || "";

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
  // "ocurre": la paquetería entrega en su sucursal y el comprador pasa por el
  // paquete. Ojo, NO es `pickup_ocurre` —ese dice que el remitente puede dejar
  // el paquete en sucursal y viene en true en todas las tarifas, así que no
  // sirve para filtrar. Paquetexpress, la que más usamos, da false aquí.
  ocurre: boolean;
};

export type ShipmentResult = {
  carrier: string; // maps to our carrier keys where possible
  trackingNumber: string;
  trackingUrl: string | null;
  labelUrl: string | null;
  shipmentId: string | null; // para rastrear el envío ya cobrado si algo falla después
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

// Límites de Skydropx, medidos contra la API con cotizaciones de prueba (que no
// cuestan) en vez de descubrirlos de uno en uno con pedidos de clientes. Los
// campos de colonia, ciudad y estado no tienen tope. Pasarse devuelve un 422 y
// deja el pedido sin poder cotizar.
export const LIMITES = { name: 30, street1: 45, reference: 40 };

// Corta en el espacio anterior al límite para no partir una palabra a la mitad;
// si es un solo token larguísimo, corta duro.
function recorta(texto: string, max: number): string {
  const t = texto.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cortado = t.slice(0, max);
  const esp = cortado.lastIndexOf(" ");
  return esp > max / 2 ? cortado.slice(0, esp) : cortado;
}

// Un nombre mexicano completo se pasa de 30 con facilidad ("JOSE TRINIDAD
// CERVANTES VELAZQUEZ" son 33). Truncar a secas parte el apellido a media
// palabra en la etiqueta física, así que primero se sueltan los nombres de en
// medio y se conservan el primero y los dos apellidos, que es lo que la
// paquetería necesita para entregar.
export function recortaNombre(nombre: string, max = LIMITES.name): string {
  const n = nombre.trim().replace(/\s+/g, " ");
  if (n.length <= max) return n;

  const partes = n.split(" ");
  // Quita de en medio, de izquierda a derecha, mientras queden nombres que no
  // sean el primero ni los dos últimos.
  for (let i = 1; partes.length > 3 && i < partes.length - 2; ) {
    partes.splice(i, 1);
    if (partes.join(" ").length <= max) return partes.join(" ");
  }
  return recorta(partes.join(" "), max);
}

const addrPayload = (a: Address) => ({
  country_code: a.country_code ?? "MX",
  postal_code: a.postal_code,
  area_level1: a.area_level1,
  area_level2: a.area_level2,
  area_level3: a.area_level3,
  name: recortaNombre(a.name),
  phone: a.phone,
  email: a.email,
  street1: recorta(a.street1, LIMITES.street1),
  // Skydropx rechaza una referencia vacía en cualquiera de las dos direcciones
  reference: recorta(a.reference?.trim() || "Sin referencia", LIMITES.reference),
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
    .map((r: { id: string; provider_name: string; provider_service_level_name: string | null; provider_service_name?: string | null; total: string; days: number | null; office_delivery?: boolean }) => ({
      id: r.id,
      provider_name: r.provider_name,
      service: r.provider_service_level_name ?? r.provider_service_name ?? null,
      total: Number(r.total),
      days: r.days,
      ocurre: r.office_delivery === true,
    }))
    .sort((a: Rate, b: Rate) => a.total - b.total);

  return { quotationId, rates };
}

// Create the shipment for a chosen rate → tracking + label PDF.
export async function createShipment(quotationId: string, rate: Rate, to: Address): Promise<ShipmentResult> {
  // Falla aquí y no en Skydropx: mandar la clave vacía devuelve un error de
  // validación que no dice qué configurar, y mandar la de otra marca declara
  // mercancía que no es la del envío.
  if (!CONSIGNMENT_NOTE) {
    throw new Error(
      `Falta la clave de producto del SAT para la carta porte de "${activeBrand.key}". ` +
        "Llena `sat.consignmentCode` en lib/brand.ts o define SKYDROPX_CONSIGNMENT_NOTE.",
    );
  }
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
        package_type: PACKAGE_TYPE,
        consignment_note: CONSIGNMENT_NOTE,
      },
    }),
  });

  const id: string | null = j.data?.id ?? j.id ?? null;
  return { carrier: rate.provider_name, ...(await esperaEtiqueta(id)) };
}

// Skydropx responde JSON:API: los datos del envío van en `data.attributes` y la
// guía, el rastreo y la etiqueta en `included`, dentro del paquete. Se leían un
// nivel arriba (`j.data.label_url`, `j.data.tracking_number`), que es
// `undefined` en los tres. El envío se cobraba, el pedido se guardaba con
// `null` en guía y etiqueta, y como nada lanzaba, la acción devolvía ok: sin
// error, sin log, y la guía comprada perdida (pasó con BL-001074).
function leeEnvio(j: Record<string, any>) {
  const a = j.data?.attributes ?? j.data ?? j;
  const pkg = (j.included ?? []).find((i: { type?: string }) => i.type === "package")?.attributes ?? {};
  return {
    trackingNumber: String(pkg.tracking_number || a.master_tracking_number || ""),
    trackingUrl: (pkg.tracking_url_provider || a.tracking_url || null) as string | null,
    labelUrl: (pkg.label_url || a.label_urls?.[0] || null) as string | null,
    shipmentId: (a.id ?? j.data?.id ?? null) as string | null,
    fallo: (a.error_detail ?? null) as string | null,
  };
}

// La etiqueta no viene en la respuesta del POST: Skydropx la genera aparte y
// tarda un par de minutos (en BL-001074, dos y medio). Se relee el envío hasta
// que aparece, igual que ya se hace al cotizar.
async function esperaEtiqueta(shipmentId: string | null) {
  if (!shipmentId) return { trackingNumber: "", trackingUrl: null, labelUrl: null, shipmentId: null };
  let d = leeEnvio(await api(`/shipments/${shipmentId}`));
  for (let i = 0; i < 12 && !d.labelUrl && !d.fallo; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    d = leeEnvio(await api(`/shipments/${shipmentId}`));
  }
  // El envío ya está pagado, así que un fallo aquí no puede tirar lo que sí
  // llegó: se devuelve la guía aunque falte la etiqueta y quien llama decide.
  return { trackingNumber: d.trackingNumber, trackingUrl: d.trackingUrl, labelUrl: d.labelUrl, shipmentId };
}

// Re-read a resolved quotation and find one rate by id.
//
// The chosen rate id travels through the browser, so the shipment must not be
// built from whatever comes back: this refetches the quotation from Skydropx
// and returns the real rate, or null if that id is not part of it. It also
// gives us provider_name and total, which the caller needs and the client
// should not be trusted to supply.
export async function rateById(quotationId: string, rateId: string): Promise<Rate | null> {
  const data = await api(`/quotations/${quotationId}`);
  const rates: Rate[] = (data.rates ?? [])
    .filter((r: { success?: boolean; total?: string | number }) => r.success && r.total != null)
    .map((r: { id: string; provider_name: string; provider_service_level_name: string | null; provider_service_name?: string | null; total: string; days: number | null; office_delivery?: boolean }) => ({
      id: r.id,
      provider_name: r.provider_name,
      service: r.provider_service_level_name ?? r.provider_service_name ?? null,
      total: Number(r.total),
      days: r.days,
      ocurre: r.office_delivery === true,
    }));
  return rates.find((r) => String(r.id) === String(rateId)) ?? null;
}

// One-shot: quote → cheapest rate → shipment. Throws if no rates.
export async function generateLabel(to: Address): Promise<ShipmentResult> {
  const { quotationId, rates } = await quote(to);
  if (!rates.length) throw new Error("Skydropx: sin tarifas disponibles para esta dirección");
  return createShipment(quotationId, rates[0], to);
}
