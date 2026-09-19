import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Dashboards generativos — el contrato entre el modelo y el render.
//
// Dos capas:
//  1. DSL de consulta: declarativo y ACOTADO (fuente + metrica + agrupar +
//     rango + comparar + filtros). El motor lo traduce a consultas
//     parametrizadas y agrega en TS — el modelo jamas toca SQL.
//  2. Primitivas de widget: kpi, serie (linea/barras/area, multi-serie),
//     distribucion (dona), tabla y nota. Con eso se compone cualquier
//     reporte, como HTML con pocas etiquetas.
// ============================================================

export const RANGOS = { hoy: 1, "7d": 7, "30d": 30, "90d": 90 } as const;

const consultaSchema = z.object({
  fuente: z.enum(["pedidos", "trafico", "garantias", "resenas"]),
  metrica: z.enum(["ingresos", "pedidos", "pares", "ticket", "visitas", "sesiones", "conteo", "calificacion"]).default("conteo"),
  agrupar: z.enum(["ninguno", "dia", "semana", "modelo", "talla", "color", "metodo", "estado", "pagina", "origen", "dispositivo", "campana", "anuncio", "canal"]).default("ninguno"),
  rango: z.enum(["hoy", "7d", "30d", "90d"]).optional(),   // hereda el del dashboard
  comparar: z.enum(["periodo_anterior"]).optional(),        // KPI: delta; serie: 2a linea
  filtroModelo: z.string().optional(),
  limite: z.number().int().min(1).max(31).optional(),
});
export type ConsultaDSL = z.infer<typeof consultaSchema>;

export const widgetSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("kpi"), titulo: z.string(), w: z.number().int().min(2).max(12).default(3), consulta: consultaSchema }),
  z.object({
    tipo: z.literal("serie"), titulo: z.string(), w: z.number().int().min(4).max(12).default(6),
    forma: z.enum(["linea", "barras", "area"]).default("barras"),
    series: z.array(z.object({ nombre: z.string(), consulta: consultaSchema })).min(1).max(4),
  }),
  z.object({ tipo: z.literal("distribucion"), titulo: z.string(), w: z.number().int().min(3).max(6).default(4), consulta: consultaSchema }),
  z.object({ tipo: z.literal("tabla"), titulo: z.string(), w: z.number().int().min(6).max(12).default(12), consulta: consultaSchema }),
  z.object({ tipo: z.literal("nota"), titulo: z.string().optional(), w: z.number().int().min(3).max(12).default(3), texto: z.string() }),
]);
export type WidgetSpec = z.infer<typeof widgetSchema>;

export const dashboardSpecSchema = z.object({
  titulo: z.string(),
  descripcion: z.string().optional(),
  rango: z.enum(["hoy", "7d", "30d", "90d"]).default("30d"),
  widgets: z.array(widgetSchema).min(1).max(14),
});
export type DashboardSpec = z.infer<typeof dashboardSpecSchema>;

// ---- motor de consulta ------------------------------------------------------

export type ResultadoConsulta = {
  unidad: "mxn" | "numero";
  valor?: number;               // kpi
  delta?: number | null;        // kpi con comparar (proporcion, ej. 0.05 = +5%)
  serie?: { etiqueta: string; valor: number }[];
  filas?: Record<string, string | number>[]; // tabla
  columnas?: string[];
};

const PAGADOS = ["paid", "fulfilled"] as const;

function ventana(rango: keyof typeof RANGOS, atras = 0) {
  const dias = RANGOS[rango];
  const hasta = new Date(Date.now() - atras * dias * 864e5);
  const desde = new Date(hasta.getTime() - dias * 864e5);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

const diaMX = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", month: "2-digit", day: "2-digit" });
// llave ordenable AAAA-MM-DD en zona MX — DD/MM como texto ordenaba sep antes que ago
const diaISO = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
const semanaMX = (iso: string) => {
  const d = new Date(iso);
  const lunes = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5);
  return `sem ${diaMX(lunes.toISOString())}`;
};

// Filas crudas de pedidos cobrados con lo necesario para cualquier corte.
async function filasPedidos(rango: keyof typeof RANGOS, atras: number, filtroModelo?: string) {
  const db = createAdminClient();
  const { desde, hasta } = ventana(rango, atras);
  const { data } = await db
    .from("order_items")
    .select("product_name, quantity, line_total_cents, variant_label, orders!inner(status, created_at, payment_method, fulfillment_stage, total_cents, id, atribucion)")
    .in("orders.status", [...PAGADOS])
    .gte("orders.created_at", desde)
    .lt("orders.created_at", hasta);
  type Fila = {
    product_name: string; quantity: number; line_total_cents: number; variant_label: string;
    orders: { status: string; created_at: string; payment_method: string | null; fulfillment_stage: string; total_cents: number; id: string; atribucion: Record<string, string> | null };
  };
  let filas = ((data ?? []) as unknown as Fila[]).map((f) => ({
    ...f,
    modelo: f.product_name.replace(" (completa tu combo)", ""),
    talla: f.variant_label.split("/")[0]?.trim() ?? "",
    color: f.variant_label.split("/").slice(2).join("/").trim(),
  }));
  if (filtroModelo) {
    const q = filtroModelo.toLowerCase();
    filas = filas.filter((f) => f.modelo.toLowerCase().includes(q));
  }
  return filas;
}

function agrega(filas: Awaited<ReturnType<typeof filasPedidos>>, metrica: string, llave: (f: (typeof filas)[number]) => string, orden?: (f: (typeof filas)[number]) => string) {
  const m = new Map<string, { v: number; pedidos: Set<string>; orden: string }>();
  for (const f of filas) {
    const k = llave(f);
    const e = m.get(k) ?? { v: 0, pedidos: new Set<string>(), orden: orden ? orden(f) : k };
    if (metrica === "ingresos") e.v += f.line_total_cents / 100;
    else if (metrica === "pares") e.v += f.quantity;
    e.pedidos.add(f.orders.id);
    if (orden) e.orden = e.orden < orden(f) ? e.orden : orden(f);
    m.set(k, e);
  }
  return [...m.entries()].map(([etiqueta, e]) => ({
    etiqueta,
    orden: e.orden,
    valor: metrica === "pedidos" ? e.pedidos.size : metrica === "ticket" ? (e.v || 0) / Math.max(1, e.pedidos.size) : e.v,
  }));
}

function totalPedidos(filas: Awaited<ReturnType<typeof filasPedidos>>, metrica: string): number {
  const pedidos = new Map<string, number>();
  for (const f of filas) pedidos.set(f.orders.id, f.orders.total_cents);
  const ingresos = [...pedidos.values()].reduce((s, c) => s + c, 0) / 100;
  if (metrica === "ingresos") return ingresos;
  if (metrica === "pedidos") return pedidos.size;
  if (metrica === "pares") return filas.reduce((s, f) => s + f.quantity, 0);
  if (metrica === "ticket") return pedidos.size ? ingresos / pedidos.size : 0;
  return pedidos.size;
}

async function consultaPedidos(c: ConsultaDSL, rango: keyof typeof RANGOS, atras = 0): Promise<ResultadoConsulta> {
  const filas = await filasPedidos(rango, atras, c.filtroModelo);
  const unidad: "mxn" | "numero" = c.metrica === "ingresos" || c.metrica === "ticket" ? "mxn" : "numero";
  if (c.agrupar === "ninguno") return { unidad, valor: totalPedidos(filas, c.metrica) };

  const llaves: Record<string, (f: (typeof filas)[number]) => string> = {
    dia: (f) => diaMX(f.orders.created_at),
    semana: (f) => semanaMX(f.orders.created_at),
    modelo: (f) => f.modelo,
    talla: (f) => f.talla,
    color: (f) => f.color || "(sin color)",
    metodo: (f) => ({ card: "Tarjeta", oxxo: "Efectivo", spei: "SPEI", aplazo: "Aplazo", mercadopago: "Mercado Pago" }[f.orders.payment_method ?? ""] ?? f.orders.payment_method ?? "(sin método)"),
    estado: (f) => f.orders.fulfillment_stage,
    // atribucion propia (cookie del beacon guardada en el pedido)
    campana: (f) => f.orders.atribucion?.utm_campaign ?? "(sin campaña)",
    anuncio: (f) => f.orders.atribucion?.utm_content ?? f.orders.atribucion?.ad_id ?? "(sin anuncio)",
    canal: (f) => f.orders.atribucion?.utm_source ?? (f.orders.atribucion?.fbclid ? "facebook" : "(directo u orgánico)"),
  };
  const llave = llaves[c.agrupar];
  if (!llave) return { unidad, serie: [] };
  const esFecha = c.agrupar === "dia" || c.agrupar === "semana";
  let serie = agrega(filas, c.metrica, llave, esFecha ? (f) => diaISO(f.orders.created_at) : undefined);
  serie = esFecha
    ? serie.sort((a, b) => a.orden.localeCompare(b.orden))
    : serie.sort((a, b) => b.valor - a.valor).slice(0, c.limite ?? 10);
  return { unidad, serie: serie.map(({ etiqueta, valor }) => ({ etiqueta, valor })) };
}

async function consultaTrafico(c: ConsultaDSL, rango: keyof typeof RANGOS, atras = 0): Promise<ResultadoConsulta> {
  const db = createAdminClient();
  const { desde, hasta } = ventana(rango, atras);
  const { data } = await db
    .from("analytics_events")
    .select("path, source, device, session_id, created_at")
    .eq("type", "pageview")
    .gte("created_at", desde)
    .lt("created_at", hasta)
    .limit(50000);
  const filas = data ?? [];
  const valorDe = (fs: typeof filas) => (c.metrica === "sesiones" ? new Set(fs.map((f) => f.session_id)).size : fs.length);
  if (c.agrupar === "ninguno") return { unidad: "numero", valor: valorDe(filas) };
  const llaves: Record<string, (f: (typeof filas)[number]) => string> = {
    dia: (f) => diaMX(f.created_at),
    semana: (f) => semanaMX(f.created_at),
    pagina: (f) => f.path,
    origen: (f) => f.source || "(directo)",
    dispositivo: (f) => (f.device === "mobile" ? "Móvil" : "Escritorio"),
  };
  const llave = llaves[c.agrupar];
  if (!llave) return { unidad: "numero", serie: [] };
  const grupos = new Map<string, typeof filas>();
  for (const f of filas) {
    const k = llave(f);
    grupos.set(k, [...(grupos.get(k) ?? []), f]);
  }
  let serie = [...grupos.entries()].map(([etiqueta, fs]) => ({
    etiqueta, valor: valorDe(fs),
    orden: fs[0] ? diaISO(fs[0].created_at) : etiqueta,
  }));
  serie = c.agrupar === "dia" || c.agrupar === "semana"
    ? serie.sort((a, b) => a.orden.localeCompare(b.orden))
    : serie.sort((a, b) => b.valor - a.valor).slice(0, c.limite ?? 10);
  return { unidad: "numero", serie: serie.map(({ etiqueta, valor }) => ({ etiqueta, valor })) };
}

async function consultaGarantias(c: ConsultaDSL, rango: keyof typeof RANGOS): Promise<ResultadoConsulta> {
  const db = createAdminClient();
  const { desde } = ventana(rango);
  const { data } = await db.from("garantias").select("razon, created_at, cerrada_at, recibido_at").gte("created_at", desde);
  const filas = data ?? [];
  if (c.agrupar === "ninguno") return { unidad: "numero", valor: filas.length };
  if (c.agrupar === "estado") {
    const serie = [
      { etiqueta: "Abiertas", valor: filas.filter((g) => !g.recibido_at && !g.cerrada_at).length },
      { etiqueta: "Retorno recibido", valor: filas.filter((g) => g.recibido_at && !g.cerrada_at).length },
      { etiqueta: "Resueltas", valor: filas.filter((g) => g.cerrada_at).length },
    ];
    return { unidad: "numero", serie };
  }
  return { unidad: "numero", filas: filas.map((g) => ({ razon: g.razon, abierta: g.created_at.slice(0, 10), estado: g.cerrada_at ? "resuelta" : g.recibido_at ? "retorno recibido" : "abierta" })), columnas: ["razon", "abierta", "estado"] };
}

async function consultaResenas(c: ConsultaDSL, rango: keyof typeof RANGOS): Promise<ResultadoConsulta> {
  const db = createAdminClient();
  const { desde } = ventana(rango);
  const { data } = await db.from("reviews").select("rating, product_id, created_at, products(name)").gte("created_at", desde);
  type R = { rating: number; products: { name: string } | null };
  const filas = (data ?? []) as unknown as R[];
  if (c.metrica === "calificacion") {
    const prom = filas.length ? filas.reduce((s, r) => s + r.rating, 0) / filas.length : 0;
    return { unidad: "numero", valor: Math.round(prom * 10) / 10 };
  }
  if (c.agrupar === "modelo") {
    const m = new Map<string, number[]>();
    for (const r of filas) {
      const n = r.products?.name ?? "(sin modelo)";
      m.set(n, [...(m.get(n) ?? []), r.rating]);
    }
    return { unidad: "numero", serie: [...m.entries()].map(([etiqueta, rs]) => ({ etiqueta, valor: Math.round((rs.reduce((s, x) => s + x, 0) / rs.length) * 10) / 10 })) };
  }
  return { unidad: "numero", valor: filas.length };
}

export async function ejecutarConsulta(c: ConsultaDSL, rangoDashboard: keyof typeof RANGOS): Promise<ResultadoConsulta> {
  const rango = (c.rango ?? rangoDashboard) as keyof typeof RANGOS;
  const corre = async (atras = 0) => {
    if (c.fuente === "pedidos") return consultaPedidos(c, rango, atras);
    if (c.fuente === "trafico") return consultaTrafico(c, rango, atras);
    if (c.fuente === "garantias") return consultaGarantias(c, rango);
    return consultaResenas(c, rango);
  };
  const actual = await corre(0);
  if (c.comparar === "periodo_anterior" && actual.valor != null) {
    const anterior = await corre(1);
    actual.delta = anterior.valor ? (actual.valor - anterior.valor) / anterior.valor : null;
  }
  return actual;
}

// ---- parcheo -----------------------------------------------------------------

export const operacionSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("agregar"), widget: widgetSchema, posicion: z.number().int().min(0).optional() }),
  z.object({ op: z.literal("quitar"), indice: z.number().int().min(0) }),
  z.object({ op: z.literal("reemplazar"), indice: z.number().int().min(0), widget: widgetSchema }),
  z.object({ op: z.literal("configurar"), titulo: z.string().optional(), descripcion: z.string().optional(), rango: z.enum(["hoy", "7d", "30d", "90d"]).optional() }),
]);
export type Operacion = z.infer<typeof operacionSchema>;

export function aplicarOperaciones(spec: DashboardSpec, ops: Operacion[]): DashboardSpec {
  const widgets = [...spec.widgets];
  let meta = { titulo: spec.titulo, descripcion: spec.descripcion, rango: spec.rango };
  for (const o of ops) {
    if (o.op === "agregar") widgets.splice(o.posicion ?? widgets.length, 0, o.widget);
    else if (o.op === "quitar") {
      if (o.indice >= widgets.length) throw new Error(`No existe el widget ${o.indice}`);
      widgets.splice(o.indice, 1);
    } else if (o.op === "reemplazar") {
      if (o.indice >= widgets.length) throw new Error(`No existe el widget ${o.indice}`);
      widgets[o.indice] = o.widget;
    } else {
      meta = { titulo: o.titulo ?? meta.titulo, descripcion: o.descripcion ?? meta.descripcion, rango: o.rango ?? meta.rango };
    }
  }
  // el resultado COMPLETO se revalida: un parche no puede dejar un spec invalido
  return dashboardSpecSchema.parse({ ...meta, widgets });
}
