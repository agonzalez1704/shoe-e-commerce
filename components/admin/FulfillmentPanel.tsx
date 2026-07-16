"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Truck, Package, Storefront, House, Circle, ArrowSquareOut } from "@phosphor-icons/react";
import { saveTracking, setFulfillmentStage } from "@/app/admin/actions";
import { STAGES, CARRIERS, stageIndex, trackingUrlFor, type FulfillmentStage } from "@/lib/fulfillment";

type Order = {
  id: string;
  paymentStatus: string;
  fulfillment_stage: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  estimated_delivery: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
};

const STAGE_ICON: Record<FulfillmentStage, React.ComponentType<{ size?: number; weight?: "bold" | "fill" | "regular" }>> = {
  pending: Circle,
  in_production: Package,
  ready: Storefront,
  shipped: Truck,
  delivered: House,
};

export function FulfillmentPanel({ order }: { order: Order }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [trackUrl, setTrackUrl] = useState(order.tracking_url ?? "");
  const [eta, setEta] = useState(order.estimated_delivery ?? "");

  const curIdx = stageIndex(order.fulfillment_stage);
  const next = STAGES[curIdx + 1]?.key as FulfillmentStage | undefined;
  const autoUrl = trackingUrlFor(carrier, tracking, trackUrl || null);
  const isPaid = order.paymentStatus === "paid" || order.paymentStatus === "fulfilled";

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const advanceLabel: Record<FulfillmentStage, string> = {
    pending: "Iniciar producción",
    in_production: "Marcar en producción",
    ready: "Marcar listo",
    shipped: "Marcar enviado",
    delivered: "Marcar entregado",
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Envío y seguimiento</h2>
        {order.estimated_delivery && (
          <span className="text-xs text-muted">Entrega estimada: <span className="text-text">{order.estimated_delivery}</span></span>
        )}
      </div>

      {/* Timeline */}
      <ol className="flex items-center">
        {STAGES.map((s, i) => {
          const done = i < curIdx;
          const current = i === curIdx;
          const Icon = done ? Check : STAGE_ICON[s.key];
          return (
            <li key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full ring-1 transition-colors ${
                    done
                      ? "bg-accent text-accent-contrast ring-accent"
                      : current
                        ? "bg-accent-soft text-accent ring-accent"
                        : "bg-elevated text-muted ring-border"
                  }`}
                >
                  <Icon size={16} weight={done || current ? "bold" : "regular"} />
                </span>
                <span className={`text-[10px] ${current ? "font-semibold text-text" : "text-muted"}`}>{s.short}</span>
              </div>
              {i < STAGES.length - 1 && (
                <span className={`mx-1 h-0.5 flex-1 rounded ${i < curIdx ? "bg-accent" : "bg-border"}`} />
              )}
            </li>
          );
        })}
      </ol>

      {/* Tracking form */}
      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Paquetería
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-sm text-text outline-none focus:border-accent"
          >
            <option value="">— Selecciona —</option>
            {CARRIERS.map((c) => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Número de guía
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="1234567890"
            className="nums mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </label>
        <label className="text-xs text-muted">
          Entrega estimada
          <input
            type="date"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="nums mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </label>
        <label className="text-xs text-muted">
          URL de rastreo (opcional)
          <input
            value={trackUrl}
            onChange={(e) => setTrackUrl(e.target.value)}
            placeholder="Auto si la paquetería es conocida"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {autoUrl ? (
          <a href={autoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
            Ver rastreo <ArrowSquareOut size={12} />
          </a>
        ) : <span />}
        <button
          disabled={isPending}
          onClick={() => run(() => saveTracking(order.id, { carrier: carrier || null, trackingNumber: tracking || null, trackingUrl: trackUrl || null, estimatedDelivery: eta || null }))}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-elevated disabled:opacity-50"
        >
          Guardar seguimiento
        </button>
      </div>

      {/* Advance stage */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {next ? (
          <>
            <button
              disabled={isPending || (next === "shipped" && !isPaid)}
              onClick={() => run(() => setFulfillmentStage(order.id, next))}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Truck size={15} weight="bold" /> {advanceLabel[next]}
            </button>
            {next === "shipped" && (
              <span className="text-xs text-muted">
                {!isPaid ? "Requiere pago confirmado." : "Notificará al cliente por correo con la guía."}
              </span>
            )}
          </>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Check size={15} weight="bold" className="text-accent" /> Pedido entregado.
          </p>
        )}
        {curIdx > 0 && curIdx < STAGES.length && (
          <button
            disabled={isPending}
            onClick={() => run(() => setFulfillmentStage(order.id, STAGES[curIdx - 1].key as FulfillmentStage))}
            className="text-xs text-muted transition-colors hover:text-text disabled:opacity-50"
          >
            ← Regresar etapa
          </button>
        )}
      </div>
    </div>
  );
}
