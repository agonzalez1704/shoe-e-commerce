"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Circle } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { lookupOrder, type TrackedOrder } from "@/app/rastrear/actions";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const STEPS = [
  { key: "pending", label: "Pendiente de pago" },
  { key: "paid", label: "Pagado · en preparación" },
  { key: "fulfilled", label: "Enviado" },
];
const INPUT = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-text";

export function TrackOrder() {
  const [result, setResult] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const orderNumber = (f.elements.namedItem("o") as HTMLInputElement).value;
    const email = (f.elements.namedItem("e") as HTMLInputElement).value;
    startTransition(async () => {
      setError(null);
      const res = await lookupOrder(orderNumber, email);
      if ("error" in res) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res.order);
      }
    });
  }

  const stepIndex = result ? STEPS.findIndex((s) => s.key === result.status) : -1;
  const terminal = result && (result.status === "cancelled" || result.status === "refunded");

  return (
    <div className="mx-auto max-w-lg">
      <form onSubmit={onSubmit} className="space-y-3">
        <input name="o" placeholder="Número de pedido (BL-001234)" required className={INPUT} />
        <input name="e" type="email" placeholder="Correo del pedido" required className={INPUT} />
        {error && <p className="text-sm text-accent">{error}</p>}
        <button
          disabled={isPending}
          className="w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast disabled:bg-border disabled:text-muted"
        >
          {isPending ? "Buscando…" : "Rastrear pedido"}
        </button>
      </form>

      {result && (
        <div className="mt-8 rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <h2 className="nums font-semibold">{result.orderNumber}</h2>
            <span className="nums text-sm text-muted">{mxn(result.totalCents)}</span>
          </div>

          {terminal ? (
            <p className="mt-4 text-sm text-muted">
              Pedido {result.status === "cancelled" ? "cancelado" : "reembolsado"}.
            </p>
          ) : (
            <ol className="mt-5 space-y-3">
              {STEPS.map((s, i) => {
                const done = i <= stepIndex;
                return (
                  <li key={s.key} className={`flex items-center gap-2 text-sm ${done ? "text-text" : "text-muted"}`}>
                    {done ? <CheckCircle size={18} weight="fill" className="text-accent" /> : <Circle size={18} />}
                    {s.label}
                  </li>
                );
              })}
            </ol>
          )}

          {result.status === "pending" && result.payment && (
            <div className="mt-4 rounded-lg bg-accent-soft p-3 text-sm">
              <p className="font-medium text-accent">Falta tu pago</p>
              {result.payment.reference && <p className="nums mt-1 text-muted">Referencia de pago en efectivo: {result.payment.reference}</p>}
              {result.payment.clabe && <p className="nums mt-1 text-muted">CLABE SPEI: {result.payment.clabe}</p>}
              {result.payment.voucherUrl && (
                <a href={result.payment.voucherUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-accent underline">
                  Ver comprobante
                </a>
              )}
            </div>
          )}

          <ul className="mt-4 space-y-1 border-t border-border pt-4 text-sm text-muted">
            {result.items.map((it, i) => (
              <li key={i} className="capitalize">{it.name} × {it.quantity}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
