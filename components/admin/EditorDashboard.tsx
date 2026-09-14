"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { PaperPlaneRight, Sparkle, X, ArrowLeft, Wrench } from "@phosphor-icons/react";
import { Widget, CLASE_WIDGET, estiloWidget, type WidgetDatos } from "@/components/admin/WidgetsDashboard";

// Editor del dashboard: chat de parcheo a la IZQUIERDA, canvas a la derecha
// (referencia del usuario). El estado compartido agente<->UI es el spec en la
// base: el chat lo parcha via parcharDashboard y el canvas se re-renderiza con
// router.refresh() — sin estados paralelos que desincronizar. Clic en un
// widget = seleccion; el mensaje viaja etiquetado [widget N] y el modelo opera
// sobre ese indice.

export function EditorDashboard({ dashboardId, titulo, widgets }: {
  dashboardId: string;
  titulo: string;
  widgets: WidgetDatos[];
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/admin/chat", body: { dashboardId } }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: () => router.refresh(), // el spec pudo cambiar: canvas al dia
  });
  const ocupado = status === "submitted" || status === "streaming";

  const enviar = (texto: string) => {
    const t = texto.trim();
    if (!t || ocupado) return;
    const etiquetado = seleccion != null ? `[widget ${seleccion}: "${widgets[seleccion]?.tipo === "nota" ? "nota" : (widgets[seleccion] as { titulo?: string }).titulo ?? ""}"] ${t}` : t;
    void sendMessage({ text: etiquetado });
    setInput("");
    setSeleccion(null);
    setTimeout(() => finRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  return (
    <div className="fixed inset-0 z-40 flex bg-bg">
      {/* panel de conversación */}
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link href={`/admin/dashboards/${dashboardId}`} aria-label="Salir del editor"
            className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:text-text">
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{titulo}</p>
            <p className="text-[11px] text-muted">Editando con el Asistente</p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="rounded-xl border border-border bg-elevated/50 p-3 text-xs text-muted">
              <p className="flex items-center gap-1.5 font-medium text-text"><Sparkle size={13} className="text-accent" /> Pide cambios en lenguaje natural</p>
              <p className="mt-1.5">"Agrega una gráfica de garantías" · "Quita la tabla" · "Compara ingresos vs mes anterior". Haz clic en un widget para referirte a él.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={`max-w-[92%] space-y-1.5 text-sm ${m.role === "user" ? "rounded-xl bg-accent px-3 py-2 text-accent-contrast" : ""}`}>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "user"
                      ? <span key={i}>{part.text.replace(/^\[widget \d+:[^\]]*\]\s*/, "")}</span>
                      : <p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed">{part.text}</p>;
                  }
                  if (part.type === "tool-parcharDashboard") {
                    if (part.state === "output-available") {
                      const out = part.output as { ok: boolean; error?: string };
                      return (
                        <p key={i} className={`rounded-lg px-2.5 py-1.5 text-[11px] ${out.ok ? "bg-elevated text-muted" : "bg-accent-soft text-accent"}`}>
                          {out.ok ? "✓ Cambios aplicados" : `No se aplicó: ${out.error}`}
                        </p>
                      );
                    }
                    return <p key={i} className="flex items-center gap-1.5 text-[11px] text-muted"><Wrench size={11} /> Aplicando cambios…</p>;
                  }
                  if (part.type.startsWith("tool-")) {
                    return <p key={i} className="flex items-center gap-1.5 text-[11px] text-muted"><Wrench size={11} /> Consultando…</p>;
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
          {ocupado && <p className="text-[11px] text-muted">Pensando…</p>}
          {error && <p className="rounded-lg bg-accent-soft px-2.5 py-1.5 text-[11px] text-accent">Falló: {error.message}</p>}
          <div ref={finRef} />
        </div>

        <div className="border-t border-border p-3">
          {seleccion != null && (
            <p className="mb-2 flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-medium text-accent">
              widget {seleccion} seleccionado
              <button onClick={() => setSeleccion(null)} aria-label="Quitar selección" className="ml-auto"><X size={12} /></button>
            </p>
          )}
          <form onSubmit={(e) => { e.preventDefault(); enviar(input); }} className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={seleccion != null ? "Refina este elemento…" : "Pide un cambio…"}
              className="h-11 flex-1 rounded-xl border border-border bg-bg px-3 text-sm outline-none focus:border-accent"
            />
            <button disabled={ocupado || !input.trim()} aria-label="Enviar"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-contrast disabled:opacity-40">
              <PaperPlaneRight size={16} weight="fill" />
            </button>
          </form>
        </div>
      </aside>

      {/* canvas */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-stretch gap-4">
            {widgets.map((w, i) => (
              <div
                key={i}
                onClick={() => setSeleccion(seleccion === i ? null : i)}
                style={estiloWidget(w.w)}
                className={`${CLASE_WIDGET} cursor-pointer rounded-2xl transition-shadow ${seleccion === i ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-border"}`}
                title={`widget ${i} — clic para seleccionar`}
              >
                <Widget datos={w} suelto />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
