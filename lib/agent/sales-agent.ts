import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buscarProducto } from "@/lib/analytics";
import { SITE_URL } from "@/lib/site";
import { activeBrand } from "@/lib/brand";
import { CASH_CHAINS_SHORT } from "@/lib/payment-method";
import type { Turn } from "@/lib/agent/memoria";

const MODEL = process.env.OPENROUTER_AGENT_MODEL ?? "anthropic/claude-sonnet-4.6";
const MAX_STEPS = 4;

// El prompt es la voz de la tienda ante un cliente por WhatsApp, así que sale
// de la config y no del código: decía "calzado de piel hecho a mano en México",
// "fabrica SOBRE PEDIDO" y "entrega en 4-7 días hábiles" para cualquier marca.
// Una regla cuya copy no está definida simplemente no se enuncia — es preferible
// a que el asistente prometa por su cuenta.
const REGLAS = [
  "Responde en español, breve, amable y claro. Usa las herramientas; no inventes precios ni datos.",
  "Usa buscar_producto para precio, color, talla (si aplica), disponibilidad y el enlace de compra.",
  activeBrand.copy?.madeToOrderLine &&
    `${activeBrand.name} vende SOBRE PEDIDO: si un producto trae "disponible": true o "stock": "sobre pedido", ` +
      `SIEMPRE se puede comprar aunque el stock sea 0. NUNCA digas que está agotado. ${activeBrand.copy.madeToOrderLine}`,
  `Para comprar, comparte el "link" del producto (o ${SITE_URL}/products).`,
  // La lista de tiendas sale de payment-method.ts, que es la que de verdad
  // describe la red del voucher. La advertencia de OXXO se queda: el método
  // interno se llama "oxxo" y no se paga en OXXO.
  activeBrand.copy?.paymentNote &&
    `${activeBrand.copy.paymentNote} El pago en efectivo es un voucher que se paga en ${CASH_CHAINS_SHORT} ` +
      "y más de 20,000 tiendas; NO se acepta OXXO.",
  "Estado de un pedido: pide el número (BL-XXXXXX) y el correo, luego usa estado_pedido.",
  "Si el cliente pide un reclamo, cambio/devolución, factura, o algo que no puedas resolver, usa pasar_a_asesor con el motivo y avísale que un asesor lo atenderá.",
].filter(Boolean);

const SYSTEM = `Eres el asistente de ventas por WhatsApp de ${activeBrand.name} (${SITE_URL}). ${activeBrand.description}

Reglas:
${REGLAS.map((r) => `- ${r}`).join("\n")}`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_producto",
      description: "Busca productos por nombre o SKU. Devuelve precio, color, talla, disponibilidad, entrega y link.",
      parameters: { type: "object", properties: { q: { type: "string", description: "nombre o SKU" } }, required: ["q"] },
    },
  },
  {
    type: "function",
    function: {
      name: "estado_pedido",
      description: "Consulta el estado de un pedido por número (BL-XXXXXX) y correo.",
      parameters: {
        type: "object",
        properties: { order_number: { type: "string" }, email: { type: "string" } },
        required: ["order_number", "email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pasar_a_asesor",
      description: "Escala la conversación a un asesor humano (reclamos, cambios, facturación, casos especiales).",
      parameters: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"] },
    },
  },
];

async function estadoPedido(orderNumber: string, email: string) {
  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("order_number, status, total_cents, payment_method, order_items(product_name, quantity)")
    .eq("order_number", orderNumber.trim().toUpperCase())
    .ilike("email", email.trim())
    .maybeSingle();
  if (!order) return { encontrado: false };
  return {
    encontrado: true,
    pedido: order.order_number,
    estado: order.status,
    total_mxn: Number((order.total_cents / 100).toFixed(2)),
    metodo: order.payment_method,
    productos: (order.order_items ?? []).map((i) => `${i.product_name} x${i.quantity}`).join(", "),
  };
}

type OAIMessage = { role: string; content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; tool_call_id?: string };

async function openrouter(messages: OAIMessage[]) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto" }),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message as OAIMessage;
}

// Run the LLM tool-loop over the conversation. Returns the reply + optional escalation.
export async function responderMensaje(historial: Turn[]): Promise<{ texto: string; escalar?: { motivo: string } }> {
  const messages: OAIMessage[] = [{ role: "system", content: SYSTEM }, ...historial.map((t) => ({ role: t.role, content: t.content }))];
  let escalar: { motivo: string } | undefined;

  for (let step = 0; step < MAX_STEPS; step++) {
    const msg = await openrouter(messages);

    if (!msg.tool_calls?.length) {
      return { texto: msg.content ?? "Permíteme verificar y te confirmo.", escalar };
    }

    messages.push(msg);
    for (const tc of msg.tool_calls) {
      let result: unknown;
      let args: Record<string, string> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {}
      if (tc.function.name === "buscar_producto") result = await buscarProducto(args.q ?? "");
      else if (tc.function.name === "estado_pedido") result = await estadoPedido(args.order_number ?? "", args.email ?? "");
      else if (tc.function.name === "pasar_a_asesor") {
        escalar = { motivo: args.motivo ?? "caso especial" };
        result = { ok: true };
      } else result = { error: "tool desconocida" };
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }

  return { texto: "Te paso con un asesor para ayudarte mejor.", escalar: escalar ?? { motivo: "sin resolución automática" } };
}
