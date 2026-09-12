import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { requirePermiso } from "@/lib/permisos-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ventasResumen, masVendidos, buscarPedido, estadoPedido, verificarPago,
  estadoInventario, embudoCheckout, fiadosPendientes, type Periodo,
} from "@/lib/analytics";

// Asistente del negocio: chat con herramientas SOLO de lectura mas una
// propuesta de edicion de combos que NUNCA se ejecuta sola — el modelo propone
// (tool sin execute), el humano confirma en la UI y la accion real corre con
// sus propios permisos. Modelo via AI Gateway de Vercel (OIDC en produccion).

export const maxDuration = 60;

// Caminos de modelo (en orden): con ANTHROPIC_API_KEY va directo a Anthropic; sin
// ella, via AI Gateway de Vercel (que en plan gratuito NO incluye Claude —
// necesita creditos). ADMIN_CHAT_MODEL cambia el modelo en cualquiera.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
const MODELO = process.env.ANTHROPIC_API_KEY
  ? createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(process.env.ADMIN_CHAT_MODEL ?? "claude-sonnet-4-5")
  : process.env.OPENAI_API_KEY
    ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(process.env.ADMIN_CHAT_MODEL ?? "gpt-5-mini")
    : process.env.ADMIN_CHAT_MODEL ?? "anthropic/claude-sonnet-4.5";
const periodo = z.enum(["hoy", "7d", "30d"]);

export async function POST(req: Request) {
  try {
    await requirePermiso("metricas_ver");
  } catch {
    return new Response("No autorizado", { status: 403 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: MODELO,
    system: `Eres el asistente interno de ${process.env.NEXT_PUBLIC_BRAND === "honeywhale" ? "Honeywhale" : "Calzado Blade"}, una tienda en linea mexicana de calzado de piel. Hoy es ${new Date().toLocaleDateString("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" })}.
Respondes en español, directo y con numeros concretos. Usa las herramientas para TODO dato del negocio — nunca inventes cifras. Montos en MXN.
Para cambios al combo (meter/sacar modelos, cambiar precio o cantidad) usa proponerCambioCombo: tu solo PROPONES; el administrador confirma en pantalla. Nunca afirmes que un cambio ya se aplico hasta ver el resultado de la herramienta.
Cuando te pidan graficas o visualizaciones usa mostrarGrafica (se pinta dentro del chat). No ofrezcas PNGs ni archivos: no puedes generarlos. Para ventas por dia usa ventasPorDia y grafica el resultado.`,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(8),
    tools: {
      ventasResumen: tool({
        description: "Ventas cobradas del periodo: cuantas, ingresos y ticket promedio.",
        inputSchema: z.object({ periodo }),
        execute: async ({ periodo: p }) => ventasResumen(p as Periodo),
      }),
      masVendidos: tool({
        description: "Productos mas vendidos del periodo (pares e ingresos por modelo).",
        inputSchema: z.object({ periodo, limite: z.number().int().min(1).max(20).optional() }),
        execute: async ({ periodo: p, limite }) => masVendidos(p as Periodo, limite ?? 5),
      }),
      buscarPedido: tool({
        description: "Busca pedidos por numero, correo o nombre del cliente.",
        inputSchema: z.object({ q: z.string().min(2) }),
        execute: async ({ q }) => buscarPedido(q),
      }),
      estadoPedido: tool({
        description: "Estado completo de un pedido: pago, produccion, envio y guia.",
        inputSchema: z.object({ orderNumber: z.string() }),
        execute: async ({ orderNumber }) => estadoPedido(orderNumber),
      }),
      verificarPago: tool({
        description: "Verifica contra el proveedor de pagos si un pedido ya se pago.",
        inputSchema: z.object({ orderNumber: z.string() }),
        execute: async ({ orderNumber }) => verificarPago(orderNumber),
      }),
      pedidosSinPagar: tool({
        description: "Pedidos pendientes de pago (efectivo/SPEI/Aplazo) con telefono para cobrar.",
        inputSchema: z.object({}),
        execute: async () => fiadosPendientes(),
      }),
      estadoInventario: tool({
        description: "Resumen del inventario y variantes agotadas.",
        inputSchema: z.object({}),
        execute: async () => estadoInventario(),
      }),
      embudoCheckout: tool({
        description: "Embudo del periodo: visitas, carritos, checkouts iniciados y pagados.",
        inputSchema: z.object({ periodo }),
        execute: async ({ periodo: p }) => embudoCheckout(p as Periodo),
      }),
      estadoCombo: tool({
        description: "Configuracion actual del combo: precio, cantidad y que modelos estan dentro y fuera.",
        inputSchema: z.object({}),
        execute: async () => {
          const db = createAdminClient();
          const { data } = await db.from("products")
            .select("name, status, combo_group, combo_min_qty, combo_price_cents")
            .eq("status", "active").order("name");
          const dentro = (data ?? []).filter((p) => p.combo_group);
          const fuera = (data ?? []).filter((p) => !p.combo_group);
          const cfg = dentro[0];
          return {
            combo: cfg ? { grupo: cfg.combo_group, pares: cfg.combo_min_qty, precio_mxn: (cfg.combo_price_cents ?? 0) / 100 } : null,
            dentro: dentro.map((p) => p.name),
            fuera: fuera.map((p) => p.name),
          };
        },
      }),
      ventasPorDia: tool({
        description: "Ventas cobradas agrupadas por dia del periodo: pedidos e ingresos por fecha.",
        inputSchema: z.object({ periodo }),
        execute: async ({ periodo: p }) => {
          const dias = p === "hoy" ? 1 : p === "7d" ? 7 : 30;
          const db = createAdminClient();
          const { data } = await db.from("orders")
            .select("total_cents, created_at")
            .in("status", ["paid", "fulfilled"])
            .gte("created_at", new Date(Date.now() - dias * 864e5).toISOString());
          const porDia = new Map<string, { pedidos: number; ingresos: number }>();
          for (const o of data ?? []) {
            const dia = new Date(o.created_at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", month: "2-digit", day: "2-digit" });
            const e = porDia.get(dia) ?? { pedidos: 0, ingresos: 0 };
            e.pedidos++; e.ingresos += o.total_cents;
            porDia.set(dia, e);
          }
          return [...porDia.entries()].map(([dia, e]) => ({ dia, pedidos: e.pedidos, ingresos_mxn: e.ingresos / 100 }));
        },
      }),
      // Grafica dentro del chat: el modelo arma las series y la UI las pinta
      // como barras. El execute es identidad — solo transporta los datos.
      mostrarGrafica: tool({
        description: "Pinta una grafica de barras DENTRO del chat. Usala siempre que pidan graficas. series = etiqueta + valor; unidad 'mxn' formatea pesos.",
        inputSchema: z.object({
          titulo: z.string(),
          unidad: z.enum(["mxn", "numero"]).default("numero"),
          series: z.array(z.object({ etiqueta: z.string(), valor: z.number() })).min(1).max(31),
        }),
        execute: async (input) => input,
      }),
      // V2 — sin execute: la llamada llega a la UI, el admin confirma y la
      // accion real (con permiso promociones_gestionar) corre desde el cliente.
      proponerCambioCombo: tool({
        description: "Propone cambios al combo para que el administrador los confirme: meter o sacar modelos, y/o cambiar precio o cantidad de pares. NO se aplica solo.",
        inputSchema: z.object({
          acciones: z.array(z.object({
            tipo: z.enum(["meter", "sacar"]),
            producto: z.string().describe("nombre del modelo, p. ej. 'Dallas'"),
          })).default([]),
          config: z.object({
            pares: z.number().int().min(2).optional(),
            precioMxn: z.number().positive().optional(),
          }).optional(),
          resumen: z.string().describe("frase corta de lo que se va a cambiar"),
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
