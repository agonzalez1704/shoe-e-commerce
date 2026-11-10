import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { activeBrand } from "@/lib/brand";
import { formatCents } from "@/lib/money";

// Rutas literales: el trazado de archivos del deploy solo las sigue así.
const regular = readFileSync(join(process.cwd(), "assets/outfit-400.ttf"));
const bold = readFileSync(join(process.cwd(), "assets/outfit-700.ttf"));

// Tiendas de CASH_CHAINS con logo. Alto por logo para que se vean del mismo peso.
const LOGOS: { src: string; alt: string; h: number; texto?: string }[] = [
  { src: "7eleven.svg", alt: "7-Eleven", h: 64 },
  { src: "walmart.svg", alt: "Walmart", h: 34 },
  { src: "aurrera.svg", alt: "Bodega Aurrerá", h: 46, texto: "Bodega Aurrerá" },
  { src: "circlek.svg", alt: "Circle K", h: 58 },
  { src: "sams.svg", alt: "Sam's Club", h: 28 },
  { src: "farmacias-ahorro.svg", alt: "Farmacias del Ahorro", h: 56 },
  { src: "soriana.svg", alt: "Soriana", h: 46 },
  { src: "bbva.svg", alt: "BBVA", h: 36 },
];

const PASOS = [
  "Ve a cualquiera de estas tiendas antes de que venza tu ficha.",
  "Di en caja que vas a pagar en efectivo con referencia PayCash y muestra este código.",
  "Paga el monto exacto y guarda tu ticket.",
  "Tu pedido se confirma solo cuando se acredita el pago.",
];

const TINTA = "#18181b";
const GRIS = "#71717a";
const LINEA = "#e4e4e7";
const ROJO = "#dc2626";

export type Ficha = {
  numero: string;
  totalCents: number;
  referencia: string;
  barcodeUrl: string | null;
  venceEn: string | null;
};

export function fichaEfectivo(f: Ficha, origin: string, headers?: Record<string, string>) {
  // En Vercel el servidor corre en UTC: sin zona, la fecha saldría con 6 horas de más.
  const vence = f.venceEn
    ? new Date(f.venceEn).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" })
    : null;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff", color: TINTA, padding: 64, fontFamily: "Outfit" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, color: GRIS }}>{activeBrand.name} · Pedido {f.numero}</span>
            <span style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.1 }}>{formatCents(f.totalCents, "MXN", "es-MX")}</span>
          </div>
          <span style={{ fontSize: 30, color: GRIS, paddingBottom: 14 }}>Pago en efectivo</span>
        </div>
        {vence && <span style={{ fontSize: 34, marginTop: 8 }}>Vence el {vence}</span>}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 36, padding: "36px 24px", border: `2px solid ${LINEA}`, borderRadius: 24 }}>
          {f.barcodeUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.barcodeUrl} alt="" height={210} />
          )}
          <span style={{ fontSize: 46, fontWeight: 700, letterSpacing: 3, marginTop: 20 }}>{f.referencia}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          {PASOS.map((p, i) => (
            <div key={p} style={{ display: "flex", alignItems: "flex-start", marginTop: i ? 18 : 0 }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, flexShrink: 0, borderRadius: 24, background: TINTA, color: "#fff", fontSize: 28, fontWeight: 700, marginRight: 20 }}>{i + 1}</span>
              <span style={{ fontSize: 34, lineHeight: 1.3, flex: 1 }}>{p}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", marginTop: 40 }}>
          {LOGOS.map((l) => (
            <div key={l.src} style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", width: 226, height: 112, marginBottom: 12, border: `2px solid ${LINEA}`, borderRadius: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${origin}/pay/${l.src}`} alt={l.alt} height={l.h} />
              {l.texto && <span style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{l.texto}</span>}
            </div>
          ))}
        </div>

        <span style={{ fontSize: 30, color: GRIS, marginTop: 8 }}>Y más de 20,000 tiendas. La tienda puede cobrar comisión.</span>
        <span style={{ fontSize: 42, fontWeight: 700, color: ROJO, marginTop: 20 }}>No se puede pagar en OXXO.</span>
      </div>
    ),
    {
      width: 1080,
      height: 1500,
      fonts: [
        { name: "Outfit", data: regular, weight: 400, style: "normal" },
        { name: "Outfit", data: bold, weight: 700, style: "normal" },
      ],
      headers,
    },
  );
}
