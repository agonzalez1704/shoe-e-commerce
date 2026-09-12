"use client";

import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { PaperPlaneRight, Sparkle, Wrench } from "@phosphor-icons/react";
import { aplicarCambioCombo, type PropuestaCombo } from "@/app/admin/chat-actions";

// Chat del negocio: lecturas directas (el modelo llama la herramienta y
// responde) y escrituras SIEMPRE con confirmación — la propuesta de combo se
// pinta como card con Aplicar/Cancelar y solo el clic ejecuta.

const SUGERENCIAS = [
  "¿Cómo van las ventas de la semana?",
  "¿Cuál es el modelo más vendido del mes?",
  "¿Qué pedidos siguen sin pagar?",
  "¿Qué modelos están en el combo?",
];

export function ChatNegocio() {
  const [input, setInput] = useState("");
  const finRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, addToolResult, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/admin/chat" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const ocupado = status === "submitted" || status === "streaming";

  const enviar = (texto: string) => {
    const t = texto.trim();
    if (!t || ocupado) return;
    void sendMessage({ text: t });
    setInput("");
    setTimeout(() => finRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-180px)] max-w-3xl flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="flex items-center gap-2 text-sm font-semibold"><Sparkle size={16} className="text-accent" /> Pregúntale a tu negocio</p>
            <p className="mt-1 text-xs text-muted">Ventas, pedidos, inventario, embudo y combos — con tus datos reales. Los cambios al combo siempre te piden confirmación.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGERENCIAS.map((s) => (
                <button key={s} onClick={() => enviar(s)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-text">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[85%] space-y-2 ${m.role === "user" ? "rounded-2xl bg-accent px-4 py-2.5 text-sm text-accent-contrast" : ""}`}>
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return m.role === "user"
                    ? <span key={i}>{part.text}</span>
                    : <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">{part.text}</p>;
                }
                // propuesta de combo: card de confirmación (tool sin execute)
                if (part.type === "tool-proponerCambioCombo") {
                  const input = part.input as (PropuestaCombo & { resumen?: string }) | undefined;
                  if (part.state === "output-available") {
                    const out = part.output as { ok: boolean; detalle: string[] } | { cancelado: true };
                    return (
                      <div key={i} className="rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-xs">
                        {"cancelado" in out ? "Propuesta cancelada." : (out.detalle ?? []).join(" · ")}
                      </div>
                    );
                  }
                  return (
                    <ConfirmaCombo
                      key={i}
                      resumen={input?.resumen ?? "Cambio al combo"}
                      onResolver={(output) => {
                        void addToolResult({ tool: "proponerCambioCombo", toolCallId: part.toolCallId, output });
                      }}
                      propuesta={{ acciones: input?.acciones ?? [], config: input?.config }}
                    />
                  );
                }
                // lecturas: chip discreto de actividad
                if (part.type.startsWith("tool-")) {
                  return (
                    <p key={i} className="flex items-center gap-1.5 text-[11px] text-muted">
                      <Wrench size={11} /> {etiquetaTool(part.type)}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {ocupado && <p className="text-xs text-muted">Pensando…</p>}
        {error && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">El asistente falló: {error.message}. Intenta de nuevo.</p>}
        <div ref={finRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); enviar(input); }}
        className="flex items-center gap-2 border-t border-border pt-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta lo que sea de tu negocio…"
          className="h-12 flex-1 rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-accent"
        />
        <button
          disabled={ocupado || !input.trim()}
          aria-label="Enviar"
          className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-contrast disabled:opacity-40"
        >
          <PaperPlaneRight size={18} weight="fill" />
        </button>
      </form>
    </div>
  );
}

function etiquetaTool(tipo: string) {
  const nombres: Record<string, string> = {
    "tool-ventasResumen": "Consultando ventas",
    "tool-masVendidos": "Consultando más vendidos",
    "tool-buscarPedido": "Buscando pedidos",
    "tool-estadoPedido": "Revisando el pedido",
    "tool-verificarPago": "Verificando el pago",
    "tool-pedidosSinPagar": "Buscando pedidos sin pagar",
    "tool-estadoInventario": "Revisando inventario",
    "tool-embudoCheckout": "Armando el embudo",
    "tool-estadoCombo": "Leyendo el combo",
  };
  return nombres[tipo] ?? "Consultando";
}

function ConfirmaCombo({ resumen, propuesta, onResolver }: {
  resumen: string;
  propuesta: PropuestaCombo;
  onResolver: (output: unknown) => void;
}) {
  const [aplicando, setAplicando] = useState(false);
  return (
    <div className="rounded-xl border border-accent/50 bg-accent-soft/60 p-4">
      <p className="text-sm font-semibold">Confirmar cambio al combo</p>
      <p className="mt-0.5 text-xs text-muted">{resumen}</p>
      <ul className="mt-2 space-y-0.5 text-xs">
        {(propuesta.acciones ?? []).map((a, i) => (
          <li key={i}>{a.tipo === "meter" ? "➕ Meter" : "➖ Sacar"} <span className="font-medium">{a.producto}</span></li>
        ))}
        {propuesta.config?.pares != null && <li>Pares por combo: <span className="nums font-medium">{propuesta.config.pares}</span></li>}
        {propuesta.config?.precioMxn != null && <li>Precio del combo: <span className="nums font-medium">${propuesta.config.precioMxn.toLocaleString("es-MX")}</span></li>}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          disabled={aplicando}
          onClick={async () => {
            setAplicando(true);
            const r = await aplicarCambioCombo(propuesta);
            onResolver(r);
          }}
          className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast disabled:opacity-50"
        >
          {aplicando ? "Aplicando…" : "Aplicar"}
        </button>
        <button
          disabled={aplicando}
          onClick={() => onResolver({ cancelado: true })}
          className="rounded-full border border-border px-4 py-2 text-xs text-muted hover:text-text"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
