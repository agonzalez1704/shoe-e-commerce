// ============================================================
// Fulfillment pipeline + carrier tracking helpers. One place defines the
// stages, their order/labels, and how to build a carrier tracking URL.
// ============================================================

export type FulfillmentStage = "pending" | "in_production" | "ready" | "shipped" | "delivered";

export const STAGES: { key: FulfillmentStage; label: string; short: string }[] = [
  { key: "pending", label: "Pendiente de pago", short: "Pendiente" },
  { key: "in_production", label: "Fabricando", short: "Fabricando" },
  { key: "ready", label: "Recogida por el courier", short: "Recogida" },
  { key: "shipped", label: "En camino", short: "En camino" },
  { key: "delivered", label: "Entregado", short: "Entregado" },
];

export const stageIndex = (s: string) => STAGES.findIndex((x) => x.key === s);
export const stageLabel = (s: string) => STAGES.find((x) => x.key === s)?.label ?? s;

// Mexican carriers + a tracking-URL template ({} = tracking number).
export const CARRIERS: { key: string; name: string; url?: (n: string) => string }[] = [
  { key: "estafeta", name: "Estafeta", url: (n) => `https://www.estafeta.com/Herramientas/Rastreo?guias=${n}` },
  { key: "dhl", name: "DHL", url: (n) => `https://www.dhl.com/mx-es/home/tracking/tracking-express.html?tracking-id=${n}` },
  { key: "fedex", name: "FedEx", url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
  { key: "99minutos", name: "99minutos", url: (n) => `https://tracker.99minutos.com/${n}` },
  { key: "paquetexpress", name: "Paquetexpress", url: (n) => `https://www.paquetexpress.com.mx/rastreo?guia=${n}` },
  { key: "correos", name: "Correos de México", url: (n) => `https://www.correosdemexico.gob.mx/SSLServicios/Rastreo/rastreo.aspx?guia=${n}` },
  { key: "local", name: "Entrega local (León)" },
  { key: "other", name: "Otra" },
];

// Best tracking URL for a carrier + number: an explicit override wins, else the
// carrier template, else null.
export function trackingUrlFor(carrier?: string | null, number?: string | null, override?: string | null): string | null {
  if (override) return override;
  if (!carrier || !number) return null;
  const c = CARRIERS.find((x) => x.key === carrier);
  return c?.url ? c.url(number) : null;
}

export const carrierName = (key?: string | null) => CARRIERS.find((c) => c.key === key)?.name ?? key ?? null;
