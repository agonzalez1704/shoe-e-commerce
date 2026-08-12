"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Circle } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { lookupOrder, type TrackedOrder } from "@/app/rastrear/actions";
import { activeBrand } from "@/lib/brand";
import { PASOS_CLIENTE, pasoCliente, carrierName, trackingUrlFor, fechaEntrega } from "@/lib/fulfillment";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const ITEMS_ORDERED = `${activeBrand.copy?.itemPlural ?? "Productos"} pedidos`.replace(/^./, (c) => c.toUpperCase());
const INPUT = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-text";

export function TrackOrder({ defaultOrder = "" }: { defaultOrder?: string }) {
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

  // Antes se derivaba sólo de `status`, así que un pedido ya recogido por la
  // paquetería le decía al comprador "Pagado · en preparación", y el número de
  // guía no se mostraba en ninguna pantalla del cliente.
  const stepIndex = result ? pasoCliente(result.status, result.stage) : -1;
  const rastreoUrl = result ? trackingUrlFor(result.carrier, result.trackingNumber, result.trackingUrl) : null;
  const terminal = result && (result.status === "cancelled" || result.status === "refunded");

  return (
    <div className="mx-auto max-w-lg">
      <form onSubmit={onSubmit} className="space-y-3">
        {/* Sin ejemplo en el placeholder: el prefijo vive en la BD
            (settings.order_prefix) y repetirlo aquí sería una segunda fuente de
            verdad que se desincroniza. */}
        <input name="o" defaultValue={defaultOrder} placeholder="Número de pedido" required className={INPUT} />
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
              {PASOS_CLIENTE.map((s, i) => {
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

          {/* La guía: lo que el comprador viene a buscar. Se captura en el
              admin desde hace tiempo y no se mostraba en ninguna pantalla suya. */}
          {!terminal && (result.trackingNumber || result.estimatedDelivery) && (
            <div className="mt-4 rounded-lg border border-border bg-elevated/60 p-3 text-sm">
              {result.trackingNumber && (
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-muted">{carrierName(result.carrier) ?? "Paquetería"}</span>
                  <span className="nums font-medium text-text">{result.trackingNumber}</span>
                </p>
              )}
              {result.estimatedDelivery && (
                <p className="mt-1 text-muted">
                  Entrega estimada:{" "}
                  <span className="text-text">
                    {fechaEntrega(result.estimatedDelivery)}
                  </span>
                </p>
              )}
              {rastreoUrl && (
                <a href={rastreoUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block font-medium text-accent underline">
                  Rastrear con la paquetería →
                </a>
              )}
            </div>
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

          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{ITEMS_ORDERED}</p>
            <ul className="mt-1.5 space-y-1 text-sm text-muted">
              {result.items.map((it, i) => (
                <li key={i} className="capitalize">{it.name} × {it.quantity}</li>
              ))}
            </ul>
          </div>

          {result.shipping && (result.shipping.name || result.shipping.line1) && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Datos de envío</p>
              <div className="mt-1.5 text-sm text-muted">
                {result.shipping.name && <p className="text-text">{result.shipping.name}</p>}
                {result.shipping.phone && <p className="nums">{result.shipping.phone}</p>}
                <p className="leading-relaxed">
                  {[result.shipping.line1, result.shipping.neighborhood, result.shipping.city, result.shipping.region, result.shipping.postal].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
