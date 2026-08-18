"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Truck, Package, Storefront, House, Circle, ArrowSquareOut } from "@phosphor-icons/react";
import { saveTracking, setFulfillmentStage, quoteSkydropxRates, createSkydropxLabel, generateSkydropxLabel, descartarGuia, marcarOcurre } from "@/app/admin/actions";
import { STAGES, CARRIERS, stageIndex, stageLabel, trackingUrlFor, type FulfillmentStage } from "@/lib/fulfillment";

// Los envíos son pesos cerrados; los centavos sólo estorban al comparar.
const mxn0 = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

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
  shipping_label_url: string | null;
  esOcurre?: boolean;
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
  // Se mira lo guardado, no el campo del formulario: si se leyera `tracking`,
  // teclear un dígito escondería el botón de cotizar a media captura.
  const conGuia = !!order.tracking_number;

  const [err, setErr] = useState<string | null>(null);
  type Rate = { id: string; provider_name: string; service: string | null; total: number; days: number | null };
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [quotationId, setQuotationId] = useState("");
  const [sortBy, setSortBy] = useState<"precio" | "tiempo">("precio");
  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setErr(null);
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      }
    });

  // a stage past "ready" requires confirmed payment (shipped/delivered)
  const stageBlocked = (key: FulfillmentStage) => (key === "shipped" || key === "delivered") && !isPaid;

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Envío y seguimiento
          {order.esOcurre ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              A sucursal · ocurre
            </span>
          ) : null}
        </h2>
        {order.estimated_delivery && (
          <span className="text-xs text-muted">Entrega estimada: <span className="text-text">{order.estimated_delivery}</span></span>
        )}
      </div>

      {/* Timeline — click any stage to set it directly */}
      <ol className="flex items-center">
        {STAGES.map((s, i) => {
          const done = i < curIdx;
          const current = i === curIdx;
          const Icon = done ? Check : STAGE_ICON[s.key];
          const blocked = stageBlocked(s.key);
          return (
            <li key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  disabled={isPending || current || blocked}
                  title={blocked ? "Requiere pago confirmado" : `Marcar “${s.label}”`}
                  onClick={() => run(() => setFulfillmentStage(order.id, s.key))}
                  className={`grid h-8 w-8 place-items-center rounded-full ring-1 transition-colors disabled:cursor-not-allowed enabled:hover:ring-accent ${
                    done
                      ? "bg-accent text-accent-contrast ring-accent"
                      : current
                        ? "bg-accent-soft text-accent ring-accent"
                        : "bg-elevated text-muted ring-border"
                  }`}
                >
                  <Icon size={16} weight={done || current ? "bold" : "regular"} />
                </button>
                <span className={`text-[10px] ${current ? "font-semibold text-text" : "text-muted"}`}>{s.short}</span>
              </div>
              {i < STAGES.length - 1 && (
                <span className={`mx-1 h-0.5 flex-1 rounded ${i < curIdx ? "bg-accent" : "bg-border"}`} />
              )}
            </li>
          );
        })}
      </ol>

      {/* Abierto mientras no haya guía, que es cuando hace falta. Con guía ya
          generada el envío está en manos de la paquetería, así que el formulario
          se pliega: queda a un clic para corregir un dato, sin invitar a
          recapturar lo que ya está bien. */}
      <details className="border-t border-border pt-4" open={!conGuia}>
        <summary className="cursor-pointer list-none text-xs font-medium text-text transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
          {conGuia ? "Corregir guía" : "Capturar guía manualmente"}
          <span className="ml-1.5 font-normal text-muted">— paquetería y número de guía</span>
        </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
      {/* "Guardar" vive dentro del desplegable: es lo que guarda estos campos y
          fuera quedaba suelto abajo, sin nada que guardar cuando el formulario
          estaba cerrado. */}
      <button
        disabled={isPending}
        onClick={() => run(() => saveTracking(order.id, { carrier: carrier || null, trackingNumber: tracking || null, trackingUrl: trackUrl || null, estimatedDelivery: eta || null }))}
        className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-elevated disabled:opacity-50"
      >
        Guardar
      </button>
      </details>

      {/* El comprador pasa por el paquete a la sucursal. La cotización ya sólo
          ofrece paqueterías que entregan ahí; la sucursal se elige al hacer la
          guía, porque el buscador de sucursales vive en el panel de Skydropx. */}
      {/* El comprador puede pedir la sucursal por WhatsApp después de comprar, y
          los pedidos anteriores a la casilla del checkout no la traen. Sólo
          mientras no haya guía: cambiarlo después no movería un envío ya pagado. */}
      {!conGuia && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-xs transition-colors hover:border-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
          <input
            type="checkbox"
            checked={!!order.esOcurre}
            disabled={isPending}
            onChange={(e) => run(async () => {
              const res = await marcarOcurre(order.id, e.target.checked);
              if (!res.ok) setErr(res.error);
            })}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
          <span>
            <strong className="text-text">Entrega a sucursal (ocurre)</strong>
            <span className="mt-0.5 block text-muted">
              {order.esOcurre
                ? "Sólo se listan paqueterías que entregan en sucursal, y la guía se genera marcada como ocurre."
                : "Márcalo si el cliente pasa por su paquete a la sucursal en vez de recibirlo en casa."}
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {autoUrl ? (
          <a href={autoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
            Ver rastreo <ArrowSquareOut size={12} />
          </a>
        ) : <span />}
        {/* Con guía ya generada no se cotiza: el envío está pagado y en manos de
            la paquetería, y volver a cotizar sólo lleva a generar una segunda
            guía y pagarla otra vez. Para reemplazarla hay que borrar la actual. */}
        {!conGuia && (
          <button
            disabled={isPending}
            onClick={() => run(async () => {
              const q = await quoteSkydropxRates(order.id);
              if (!q.ok) { setErr(q.error); return; }
              if (q.local) { await generateSkydropxLabel(order.id); return; }  // León lo entregamos nosotros
              setQuotationId(q.quotationId!);
              setRates(q.rates as Rate[]);
            })}
            className="inline-flex items-center gap-1.5 rounded-full bg-text px-4 py-2 text-sm font-medium text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <Truck size={14} weight="bold" /> {isPending ? "Cotizando…" : "Cotizar paqueterías"}
          </button>
        )}
      </div>

      {rates && (() => {
        // La decisión real es precio contra tiempo, no precio a secas: una lista
        // ordenada sólo por precio esconde que $27 más pueden ser tres días menos.
        const conDias = rates.filter((r) => r.days != null);
        const barata = rates.reduce((a, b) => (b.total < a.total ? b : a), rates[0]);
        const rapida = conDias.length ? conDias.reduce((a, b) => (b.days! < a.days! ? b : a), conDias[0]) : null;
        const orden = [...rates].sort((a, b) =>
          sortBy === "precio"
            ? a.total - b.total
            : (a.days ?? 99) - (b.days ?? 99) || a.total - b.total,
        );
        return (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-elevated px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {rates.length} {rates.length === 1 ? "opción" : "opciones"}
            </p>
            <div className="flex items-center gap-1">
              {(["precio", "tiempo"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setSortBy(k)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    sortBy === k ? "bg-text text-bg" : "text-muted hover:text-text"
                  }`}
                >
                  {k === "precio" ? "Más barata" : "Más rápida"}
                </button>
              ))}
              <button onClick={() => setRates(null)} className="ml-2 text-xs text-muted hover:text-text">Cerrar</button>
            </div>
          </div>

          {rates.length === 0 && (
            <p className="px-3 py-5 text-sm text-muted">
              Ninguna paquetería cotizó esta dirección. Revisa el código postal y la colonia.
            </p>
          )}

          <ul className="divide-y divide-border">
            {orden.map((r) => {
              const extra = r.total - barata.total;
              const ahorro = barata.days != null && r.days != null ? barata.days - r.days : 0;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-3 transition-colors hover:bg-elevated/50">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium capitalize">
                      {r.provider_name.toLowerCase()}
                      {r.service && <span className="font-normal normal-case text-muted">{r.service}</span>}
                      {r.id === barata.id && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">más barata</span>
                      )}
                      {rapida && r.id === rapida.id && r.id !== barata.id && (
                        <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text">más rápida</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.days != null ? `Entrega en ${r.days} ${r.days === 1 ? "día" : "días"}` : "Tiempo no informado"}
                      {/* el intercambio, escrito: cuánto cuesta ganar cada día */}
                      {extra > 0 && ahorro > 0 && (
                        <span className="text-text"> · +{mxn0(extra)} por {ahorro} {ahorro === 1 ? "día" : "días"} menos</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="nums text-sm font-semibold">{mxn0(r.total)}</span>
                    <button
                      disabled={isPending}
                      onClick={() => run(async () => {
                        const res = await createSkydropxLabel(order.id, quotationId, r.id);
                        if (!res.ok) { setErr(res.error); return; }   // deja la lista abierta para reintentar
                        setRates(null);
                      })}
                      className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast transition-transform active:scale-[0.98] disabled:opacity-50"
                    >
                      {isPending ? "…" : "Generar guía"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        );
      })()}

      {err && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">{err}</p>}
      {(order.shipping_label_url || conGuia) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {order.shipping_label_url ? (
            <a href={order.shipping_label_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              <ArrowSquareOut size={12} /> Descargar etiqueta (PDF)
            </a>
          ) : <span />}
          {/* La salida cuando la guía ya no sirve —cancelada en Skydropx, o mal
              capturada—. Sin esto el pedido se queda atorado: hay guía, así que
              el botón de cotizar no se pinta, y no había forma de quitarla. */}
          <button
            disabled={isPending}
            onClick={() => {
              if (!confirm("¿Quitar la guía de este pedido para poder generar otra?\n\nEsto NO la cancela en Skydropx: si sigue viva, cancélala allá primero o pagarás dos envíos.")) return;
              run(async () => {
                const res = await descartarGuia(order.id);
                if (!res.ok) setErr(res.error);
              });
            }}
            className="text-xs text-muted underline-offset-2 transition-colors hover:text-accent hover:underline disabled:opacity-50"
          >
            Quitar guía y volver a cotizar
          </button>
        </div>
      )}

      {/* Advance stage */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {next ? (
          <>
            <button
              disabled={isPending || (next === "shipped" && !isPaid)}
              onClick={() => run(() => setFulfillmentStage(order.id, next))}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Truck size={15} weight="bold" /> Marcar “{stageLabel(next)}”
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
