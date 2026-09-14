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

// ============================================================
// Lo que ve el comprador. Deriva de LAS DOS columnas a propósito.
//
// `status` y `fulfillment_stage` se mueven por separado y en la práctica la
// etapa se queda atrás: hoy 36 de 43 pedidos siguen en etapa `pending` aunque
// estén pagados. Pintar sólo la etapa le diría "Pendiente de pago" a alguien
// que ya pagó; pintar sólo el estado esconde que su pedido ya lo recogió el
// courier. Se toma el más avanzado de los dos.
// ============================================================
export const PASOS_CLIENTE = [
  { key: "pending", label: "Pendiente de pago" },
  { key: "paid", label: "Pagado · en preparación" },
  { key: "ready", label: "Recogido por la paquetería" },
  { key: "shipped", label: "En camino" },
  { key: "delivered", label: "Entregado" },
] as const;

export function pasoCliente(status: string, stage: string | null, conGuia = false): number {
  if (status === "pending") return 0;              // sin pago no hay entrega que contar
  const porEtapa: Record<string, number> = {
    pending: 1, in_production: 1, ready: 2, shipped: 3, delivered: 4,
  };
  // `fulfilled` significa "se envió" en este esquema, así que vale como piso
  // aunque nadie haya tocado la etapa.
  const piso = status === "fulfilled" ? 3 : 1;
  // Con guia generada el par ya salio de fabricacion aunque nadie haya movido
  // la etapa (BL-001107 llevaba 14 dias "en preparacion" con guia).
  return Math.max(piso, conGuia ? 2 : 0, porEtapa[stage ?? "pending"] ?? 1);
}

// ============================================================
// Cuándo llega. Tiempos MEDIDOS en los pedidos reales (sep 2026): de pago a
// envío p50 7.4 días, p90 9.3; la paquetería entrega en 1–3 días. La promesa
// anterior ("4–7 días hábiles") no se cumplía y generaba las quejas de "no sé
// nada de mi pedido". Mejor una ventana honesta con fechas que una corta falsa.
// ============================================================
export const FABRICA_DIAS = { min: 7, tipico: 8, max: 10 } as const;
const TRANSITO_DIAS = { min: 1, max: 3 } as const;

const fmtDia = (d: Date, conMes: boolean) =>
  d.toLocaleDateString("es-MX", { day: "numeric", ...(conMes ? { month: "long" as const } : {}), timeZone: "America/Mexico_City" });

export function ventanaEntrega(paidAt: string, shippedAt?: string | null) {
  const base = new Date(shippedAt ?? paidAt).getTime();
  const [a, b] = shippedAt
    ? [TRANSITO_DIAS.min, TRANSITO_DIAS.max]
    : [FABRICA_DIAS.min + TRANSITO_DIAS.min, FABRICA_DIAS.max + TRANSITO_DIAS.max];
  const desde = new Date(base + a * 864e5);
  const hasta = new Date(base + b * 864e5);
  const mismoMes = fmtDia(desde, true).split(" ").slice(-1)[0] === fmtDia(hasta, true).split(" ").slice(-1)[0];
  const texto = mismoMes
    ? `entre el ${fmtDia(desde, false)} y el ${fmtDia(hasta, true)}`
    : `entre el ${fmtDia(desde, true)} y el ${fmtDia(hasta, true)}`;
  return { desde, hasta, texto };
}

export const diasDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));

// `estimated_delivery` es una columna `date` sin hora. new Date("2026-08-18") la
// interpreta como medianoche UTC, así que en México (UTC-6) se imprime el 17 —
// un día menos en una fecha de entrega que ve el comprador. Se construye la
// fecha en local a partir de las partes.
export function fechaEntrega(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "long" });
}
