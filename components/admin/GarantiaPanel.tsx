"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, ShieldCheck, ArrowUUpLeft, PaperPlaneTilt } from "@phosphor-icons/react";
import { abrirGarantia, cotizarGarantia, generarGuiaGarantia, guardarGuiaGarantia, marcarGarantia } from "@/app/admin/garantia-actions";
import { CARRIERS, trackingUrlFor } from "@/lib/fulfillment";

const mxn0 = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

export type Garantia = {
  razon: string;
  recibido_at: string | null;
  cerrada_at: string | null;
  retorno_carrier: string | null; retorno_tracking: string | null; retorno_url: string | null; retorno_label_url: string | null;
  repo_carrier: string | null; repo_tracking: string | null; repo_url: string | null; repo_label_url: string | null;
} | null;

type Rate = { id: string; provider_name: string; service: string | null; total: number; days: number | null };

// El flujo completo de una garantía en tres pasos visibles: la guía de retorno
// (viaja del cliente a la bodega — esa etiqueta es para el CLIENTE), el acuse
// de recibido, y la guía de reposición. El estado se deriva de qué existe.
export function GarantiaPanel({ orderId, garantia }: { orderId: string; garantia: Garantia }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [razon, setRazon] = useState("");
  const [rates, setRates] = useState<{ pierna: "retorno" | "repo"; quotationId: string; lista: Rate[] } | null>(null);
  const [manual, setManual] = useState<{ pierna: "retorno" | "repo"; carrier: string; tracking: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) =>
    startTransition(async () => {
      setErr(null);
      const r = await fn();
      if (r && !r.ok) { setErr(r.error ?? "Error"); return; }
      router.refresh();
    });

  if (!garantia) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} /> Garantía</h2>
        <p className="text-xs text-muted">¿Cambio de talla, defecto, no le quedó? Abre la garantía con la razón y de ahí salen las dos guías.</p>
        <div className="flex gap-2">
          <input
            value={razon}
            onChange={(e) => setRazon(e.target.value)}
            placeholder="Razón — p. ej. No le quedó la talla"
            className="flex-1 rounded-lg border border-border bg-bg px-2.5 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            disabled={isPending || !razon.trim()}
            onClick={() => run(() => abrirGarantia(orderId, razon))}
            className="rounded-full bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          >
            Abrir garantía
          </button>
        </div>
        {err && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">{err}</p>}
      </div>
    );
  }

  const g = garantia;
  const pasoRetorno = !!g.retorno_tracking;
  const pasoRecibido = !!g.recibido_at;
  const pasoRepo = !!g.repo_tracking;

  const Pierna = ({ pierna, titulo, icono, carrier, tracking, url, label, habilitada, nota }: {
    pierna: "retorno" | "repo"; titulo: string; icono: React.ReactNode;
    carrier: string | null; tracking: string | null; url: string | null; label: string | null;
    habilitada: boolean; nota: string;
  }) => {
    const rastreo = trackingUrlFor(carrier, tracking, url);
    return (
      <div className={`rounded-xl border border-border p-3 ${habilitada ? "" : "opacity-50"}`}>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{icono} {titulo}</p>
        {tracking ? (
          <div className="mt-2 space-y-1 text-sm">
            <p><span className="capitalize text-muted">{carrier}</span> <span className="nums font-medium">{tracking}</span></p>
            <div className="flex gap-3 text-xs">
              {rastreo && <a href={rastreo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">Rastreo <ArrowSquareOut size={11} /></a>}
              {label && <a href={label} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">Etiqueta PDF <ArrowSquareOut size={11} /></a>}
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1.5 text-xs text-muted">{nota}</p>
            {habilitada && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  disabled={isPending}
                  onClick={() => run(async () => {
                    const q = await cotizarGarantia(orderId, pierna);
                    if (!q.ok) return q;
                    setRates({ pierna, quotationId: q.quotationId!, lista: q.rates as Rate[] });
                    return { ok: true };
                  })}
                  className="rounded-full bg-text px-3.5 py-1.5 text-xs font-medium text-bg disabled:opacity-50"
                >
                  {isPending ? "Cotizando…" : "Cotizar y generar"}
                </button>
                <button
                  disabled={isPending}
                  onClick={() => setManual({ pierna, carrier: "", tracking: "" })}
                  className="rounded-full border border-border px-3.5 py-1.5 text-xs text-muted hover:text-text"
                >
                  Capturar manual
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 rounded-2xl border border-accent/40 bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={16} className="text-accent" /> Garantía
          {g.cerrada_at && <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">Cerrada</span>}
        </h2>
        <span className="text-xs text-muted">{g.razon}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Pierna
          pierna="retorno" titulo="1 · Retorno" icono={<ArrowUUpLeft size={13} />}
          carrier={g.retorno_carrier} tracking={g.retorno_tracking} url={g.retorno_url} label={g.retorno_label_url}
          habilitada={!g.cerrada_at}
          nota="Del domicilio del cliente a la bodega. La etiqueta es para el cliente — la ve en su pedido en cuanto se genere."
        />
        <Pierna
          pierna="repo" titulo="2 · Reposición" icono={<PaperPlaneTilt size={13} />}
          carrier={g.repo_carrier} tracking={g.repo_tracking} url={g.repo_url} label={g.repo_label_url}
          habilitada={!g.cerrada_at && pasoRecibido}
          nota={pasoRecibido ? "El par nuevo hacia el cliente." : "Se habilita al marcar el retorno como recibido."}
        />
      </div>

      {rates && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border bg-elevated px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {rates.pierna === "retorno" ? "Retorno (cliente → sucursal en León, ocurre)" : "Reposición (bodega → cliente)"} · {rates.lista.length} opciones
            </p>
            <button onClick={() => setRates(null)} className="text-xs text-muted hover:text-text">Cerrar</button>
          </div>
          <ul className="divide-y divide-border">
            {[...rates.lista].sort((a, b) => a.total - b.total).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <p className="text-sm capitalize">{r.provider_name.toLowerCase()} <span className="text-xs normal-case text-muted">{r.service ?? ""} · {r.days != null ? `${r.days} días` : "s/d"}</span></p>
                <div className="flex items-center gap-3">
                  <span className="nums text-sm font-semibold">{mxn0(r.total)}</span>
                  <button
                    disabled={isPending}
                    onClick={() => run(async () => {
                      const res = await generarGuiaGarantia(orderId, rates.pierna, rates.quotationId, r.id);
                      if (res.ok) setRates(null);
                      return res;
                    })}
                    className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast disabled:opacity-50"
                  >
                    Generar guía
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {manual && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
          <label className="text-xs text-muted">
            Paquetería
            <select value={manual.carrier} onChange={(e) => setManual({ ...manual, carrier: e.target.value })}
              className="mt-1 block rounded-lg border border-border bg-bg px-2.5 py-2 text-sm">
              <option value="">—</option>
              {CARRIERS.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </label>
          <label className="flex-1 text-xs text-muted">
            Guía
            <input value={manual.tracking} onChange={(e) => setManual({ ...manual, tracking: e.target.value })}
              className="nums mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-sm" />
          </label>
          <button
            disabled={isPending || !manual.tracking}
            onClick={() => run(async () => {
              const r = await guardarGuiaGarantia(orderId, manual.pierna, { carrier: manual.carrier || null, tracking: manual.tracking, url: null });
              if (r.ok) setManual(null);
              return r;
            })}
            className="rounded-full bg-text px-4 py-2 text-xs font-medium text-bg disabled:opacity-50"
          >
            Guardar
          </button>
          <button onClick={() => setManual(null)} className="px-2 py-2 text-xs text-muted">Cancelar</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={pasoRecibido} disabled={isPending || !pasoRetorno}
            onChange={(e) => run(() => marcarGarantia(orderId, "recibido", e.target.checked))} className="h-3.5 w-3.5 accent-accent" />
          Retorno recibido en bodega
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={!!g.cerrada_at} disabled={isPending || !pasoRepo}
            onChange={(e) => run(() => marcarGarantia(orderId, "cerrada", e.target.checked))} className="h-3.5 w-3.5 accent-accent" />
          Garantía resuelta
        </label>
      </div>

      {err && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">{err}</p>}
    </div>
  );
}
