import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  ventasResumen,
  masVendidos,
  fiadosPendientes,
  estadoInventario,
  buscarProducto,
  listarInventarios,
  buscarPedido,
  estadoPedido,
  verificarPago,
  embudoCheckout,
  reenviarInstruccionesPago,
} from "@/lib/analytics";

export const runtime = "nodejs";
export const maxDuration = 60;

const PERIODO = z.enum(["hoy", "7d", "30d"]);

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "ventas_resumen",
      "Resumen de ventas en línea en un periodo: ingresos, número de ventas y ticket promedio.",
      { periodo: PERIODO },
      async ({ periodo }) => json(await ventasResumen(periodo)),
    );

    server.tool(
      "mas_vendidos",
      "Productos más vendidos por ingreso en un periodo (top N).",
      { periodo: PERIODO, limite: z.number().optional() },
      async ({ periodo, limite }) => json(await masVendidos(periodo, limite ?? 5)),
    );

    server.tool(
      "fiados_pendientes",
      "Pedidos pendientes de pago (efectivo/SPEI/Aplazo sin liquidar): cliente, monto, días y productos.",
      {},
      async () => json(await fiadosPendientes()),
    );

    server.tool(
      "listar_inventarios",
      "Lista los inventarios (por marca) con número de productos, unidades y valor de venta.",
      {},
      async () => json(await listarInventarios()),
    );

    server.tool(
      "estado_inventario",
      "Estado del inventario: totales y desglose por marca (productos, unidades, valor), más bajo stock y agotados.",
      {},
      async () => json(await estadoInventario()),
    );

    server.tool(
      "buscar_producto",
      "Busca productos por SKU o nombre. Devuelve marca, precio, stock, color, talla, " +
        "`disponible` y `entrega`. IMPORTANTE: los productos hecho sobre pedido (`disponible: true`, " +
        "`stock: \"sobre pedido\"`) SIEMPRE se pueden vender aunque el stock sea 0 — nunca digas que están agotados; " +
        "ofrécelos con entrega en 4-7 días hábiles.",
      { q: z.string().describe("SKU o nombre a buscar") },
      async ({ q }) => json(await buscarProducto(q)),
    );

    server.tool(
      "buscar_pedido",
      "Busca pedidos por nombre del cliente, correo, teléfono o número de pedido (BL-00XXXX). " +
        "Úsala cuando alguien dice que hizo un pedido: si no aparece, es que el checkout nunca se completó " +
        "y hay que pedirle que lo intente de nuevo.",
      { q: z.string().describe("Nombre, correo, teléfono o número de pedido") },
      async ({ q }) => json(await buscarPedido(q)),
    );

    server.tool(
      "estado_pedido",
      "Todo sobre un pedido: estado de pago, etapa de entrega, guía y rastreo, referencia de pago, " +
        "dirección de envío y datos de contacto del cliente.",
      { pedido: z.string().describe("Número de pedido, ej. BL-001043") },
      async ({ pedido }) => json(await estadoPedido(pedido)),
    );

    server.tool(
      "verificar_pago",
      "Cuando un cliente dice que ya pagó: consulta a Conekta o MercadoPago directamente y lo compara " +
        "con lo que tenemos registrado. Detecta el caso grave de dinero cobrado con el pedido sin confirmar " +
        "(webhook perdido).",
      { pedido: z.string().describe("Número de pedido, ej. BL-001043") },
      async ({ pedido }) => json(await verificarPago(pedido)),
    );

    server.tool(
      "embudo_checkout",
      "Embudo de la tienda: visitantes, cuántos vieron producto, llegaron al carrito, al checkout, " +
        "y cuántos terminaron comprando. Incluye `abandono_en_formulario`: gente que llegó al checkout y " +
        "nunca generó pedido — si ese número es alto suele ser un campo obligatorio que bloquea el botón, " +
        "no falta de interés. Revísalo a diario: esas fallas no dejan ningún otro rastro.",
      { periodo: PERIODO },
      async ({ periodo }) => json(await embudoCheckout(periodo)),
    );

    // The only tool here that writes. It emails a real customer, so it refuses
    // on a paid/expired order and rate-limits itself; if it answers
    // `enviado: false`, read `motivo` and do NOT retry.
    server.tool(
      "reenviar_instrucciones_pago",
      "Reenvía al cliente su referencia y código de barras por correo. Úsala cuando el cliente perdió " +
        "el correo o dice que no lo recibió. Solo funciona con pedidos pendientes que se pagan con " +
        "referencia (efectivo/SPEI) y cuya referencia no haya vencido. Tiene un límite de un envío cada " +
        "6 horas por pedido: si responde `enviado: false`, lee `motivo` y NO lo intentes de nuevo.",
      { pedido: z.string().describe("Número de pedido, ej. BL-001054") },
      async ({ pedido }) => json(await reenviarInstruccionesPago(pedido)),
    );
  },
  {},
  { basePath: "/api" },
);

// Bearer-token guard (Authorization: Bearer <MCP_BEARER_TOKEN>).
function authorized(req: Request): boolean {
  const expected = process.env.MCP_BEARER_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  return token.length > 0 && token === expected;
}

// The transports this route actually serves. Without the check, `[transport]`
// swallows every one-segment path under /api: a typo'd or not-yet-deployed
// route answered 401 "unauthorized" instead of 404, which reads like an auth
// problem and sends you looking in the wrong place.
const TRANSPORTS = new Set(["mcp", "sse", "message"]);

async function guarded(req: Request): Promise<Response> {
  const seg = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!TRANSPORTS.has(seg)) {
    return new Response("Not Found", { status: 404 });
  }
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": "Bearer" },
    });
  }
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
