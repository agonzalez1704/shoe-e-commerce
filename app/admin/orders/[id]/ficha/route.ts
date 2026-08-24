import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { requirePermiso } from "@/lib/permisos-guard";
import { SITE_NAME } from "@/lib/site";

// Ficha de producción (tarjeta de corte) para la fábrica: una tarjeta por
// modelo+color del pedido (un combo de 2 modelos = 2 fichas). Réplica de la
// tarjeta del XLS que ya usan: PIEL/COLOR, ESTILO, PEDIDO, reja de tallas con
// cantidades, y las casillas de taller (suela, planta, horma, forros) en
// blanco para llenarse a mano allá — nosotros no tenemos esos datos.

export const instant = false;

// Reja de tallas MX de la tarjeta. Cubre el rango del catálogo.
const TALLAS = ["24", "24.5", "25", "25.5", "26", "26.5", "27", "27.5", "28", "28.5", "29", "29.5", "30", "31"];

type Ficha = {
  estilo: string;
  color: string;
  cantidades: Map<string, number>; // talla -> pares
};

// "MX 28 / medium / shedron/hueso" -> { talla: "28", color: "shedron/hueso" }
function parseVariant(label: string): { talla: string; color: string } {
  const partes = label.split("/").map((s) => s.trim());
  const talla = (partes[0] ?? "").replace(/^MX\s*/i, "");
  // el color puede traer "/" adentro (shedron/hueso): es todo lo que sigue del ancho
  const color = partes.slice(2).join("/") || partes[1] || "";
  return { talla, color };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let supabase;
  try {
    supabase = await requirePermiso("pedidos_ver");
  } catch {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const { id: param } = await params;
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(param);
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, created_at")
    .eq(esUuid ? "id" : "order_number", decodeURIComponent(param))
    .maybeSingle();
  if (!order) return new NextResponse("Pedido no encontrado", { status: 404 });

  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, variant_label, quantity")
    .eq("order_id", order.id);
  if (!items?.length) return new NextResponse("Pedido sin artículos", { status: 404 });

  // Una ficha por modelo+color; tallas repetidas suman cantidad.
  const fichas = new Map<string, Ficha>();
  for (const it of items) {
    const { talla, color } = parseVariant(it.variant_label ?? "");
    const key = `${it.product_name}|${color}`;
    const f = fichas.get(key) ?? { estilo: it.product_name, color, cantidades: new Map() };
    f.cantidades.set(talla, (f.cantidades.get(talla) ?? 0) + it.quantity);
    fichas.set(key, f);
  }

  const pedidoNum = order.order_number.replace(/\D/g, "").replace(/^0+/, "") || order.order_number;
  const fecha = new Date(order.created_at).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City",
  });
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const f of fichas.values()) dibujaFicha(pdf, f, pedidoNum, fecha, font, bold);

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ficha-${order.order_number}.pdf"`,
    },
  });
}

// Media carta horizontal: la proporción de la tarjeta física.
const W = 612;
const H = 396;

function dibujaFicha(pdf: PDFDocument, f: Ficha, pedido: string, fecha: string, font: PDFFont, bold: PDFFont) {
  const page = pdf.addPage([W, H]);
  const m = 24; // margen
  const negro = rgb(0.1, 0.1, 0.1);
  const gris = rgb(0.45, 0.45, 0.45);

  const caja = (x: number, y: number, w: number, h: number) =>
    page.drawRectangle({ x, y, width: w, height: h, borderColor: negro, borderWidth: 0.8 });
  const etiqueta = (t: string, x: number, y: number) =>
    page.drawText(t, { x, y, size: 7, font, color: gris });
  const texto = (t: string, x: number, y: number, size = 12, f2: PDFFont = bold) =>
    page.drawText(t, { x, y, size, font: f2, color: negro });
  const centrado = (t: string, cx: number, y: number, size: number, f2: PDFFont) =>
    page.drawText(t, { x: cx - f2.widthOfTextAtSize(t, size) / 2, y, size, font: f2, color: negro });

  // ---- fecha en que llego el pedido, arriba de la tarjeta
  page.drawText("FECHA", { x: m, y: H - m + 2, size: 7, font, color: gris });
  page.drawText(fecha, { x: m + 32, y: H - m + 1, size: 10, font: bold, color: negro });

  // ---- fila 1: PIEL/COLOR · ESTILO · PEDIDO
  const y1 = H - m - 78;
  const wPiel = 150, wPedido = 120;
  const wEstilo = W - 2 * m - wPiel - wPedido;
  caja(m, y1, wPiel, 78);
  etiqueta("PIEL / COLOR", m + 6, y1 + 66);
  // color largo (shedron/hueso) se parte en líneas
  const colorTxt = f.color.toUpperCase();
  const lineas = colorTxt.length > 14 ? colorTxt.split("/") : [colorTxt];
  lineas.forEach((l, i) => texto(l + (i < lineas.length - 1 ? "/" : ""), m + 8, y1 + 40 - i * 16, 13));
  caja(m + wPiel, y1, wEstilo, 78);
  etiqueta("ESTILO", m + wPiel + 6, y1 + 66);
  centrado(f.estilo.toUpperCase(), m + wPiel + wEstilo / 2, y1 + 26, 22, bold);
  caja(W - m - wPedido, y1, wPedido, 78);
  etiqueta("PEDIDO", W - m - wPedido + 6, y1 + 66);
  centrado(pedido, W - m - wPedido / 2, y1 + 26, 30, bold);

  // ---- fila 2: casillas de taller (en blanco, las llena la fábrica)
  const y2 = y1 - 44;
  const cols2 = ["CORTE", "SUELA", "PLANTA", "HORMA", "CAJA", "CLIENTE"];
  const w2 = (W - 2 * m) / cols2.length;
  cols2.forEach((c, i) => {
    caja(m + i * w2, y2, w2, 40);
    etiqueta(c, m + i * w2 + 5, y2 + 30);
  });

  // ---- reja de tallas con cantidades
  const y3 = y2 - 64;
  const wCol = (W - 2 * m) / TALLAS.length;
  TALLAS.forEach((t, i) => {
    const x = m + i * wCol;
    caja(x, y3 + 30, wCol, 26);
    centrado(t, x + wCol / 2, y3 + 39, 9, font);
    caja(x, y3, wCol, 30);
    const q = f.cantidades.get(t);
    if (q) centrado(String(q), x + wCol / 2, y3 + 10, 14, bold);
  });
  // en el hueco de 8pt entre la fila de casillas y la reja de tallas
  page.drawText("TALLA MX / PARES", { x: m, y: y3 + 57.5, size: 5.5, font, color: gris });

  // ---- fila 4: forros (en blanco) + NUMERO y TOTAL
  const y4 = y3 - 78;
  const wForro = 220;
  caja(m, y4 + 39, wForro, 34);
  etiqueta("FORRO DE CORTE", m + 6, y4 + 63);
  caja(m, y4, wForro, 34);
  etiqueta("FORRO DE PLANTILLA", m + 6, y4 + 24);
  caja(m + wForro, y4, 130, 73);
  etiqueta("MARCA", m + wForro + 6, y4 + 61);
  texto(SITE_NAME.toUpperCase(), m + wForro + 10, y4 + 30, 12);

  const total = [...f.cantidades.values()].reduce((s, n) => s + n, 0);
  const tallasUnicas = [...f.cantidades.keys()];
  const xNum = m + wForro + 130;
  const wNum = W - m - xNum;
  caja(xNum, y4, wNum, 73);
  etiqueta(tallasUnicas.length === 1 ? "NUMERO" : "TOTAL PARES", xNum + 6, y4 + 61);
  centrado(
    tallasUnicas.length === 1 ? tallasUnicas[0] : String(total),
    xNum + wNum / 2, y4 + 20, 34, bold,
  );
}
