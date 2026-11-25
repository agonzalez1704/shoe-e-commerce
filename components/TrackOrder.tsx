"use client";

import { useState, useTransition } from "react";
import { WhatsappLogo, ArrowSquareOut, WarningCircle, CreditCard, Hammer, Package, Truck, HouseLine, Check, XCircle } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { lookupOrder, type TrackedOrder } from "@/app/rastrear/actions";
import { activeBrand } from "@/lib/brand";
import { pasoCliente, carrierName, trackingUrlFor, fechaEntrega, ventanaEntrega, diasDesde, FABRICA_DIAS } from "@/lib/fulfillment";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const ITEMS_ORDERED = `${activeBrand.copy?.itemPlural ?? "Productos"} pedidos`.replace(/^./, (c) => c.toUpperCase());
const ITEM = activeBrand.copy?.itemSingular ?? "pedido";
const PLURAL = activeBrand.copy?.itemPlural ?? "productos";
const SOBRE_PEDIDO = !!activeBrand.copy?.madeToOrderLine;
const INPUT = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-text";

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }) : null;

// La pantalla responde tres preguntas en este orden: ¿dónde va mi pedido?,
// ¿cuándo llega? y ¿a quién le pregunto? Antes era una lista de palomitas sin
// fechas, con una promesa de entrega que no se cumplía y sin forma de pedir ayuda.
export function TrackOrder({ defaultOrder = "", inicial = null }: { defaultOrder?: string; inicial?: TrackedOrder | null }) {
  const [result, setResult] = useState<TrackedOrder | null>(inicial);
  const [mostrarForm, setMostrarForm] = useState(!inicial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const orderNumber = (f.elements.namedItem("o") as HTMLInputElement).value;
    const contacto = (f.elements.namedItem("e") as HTMLInputElement).value;
    startTransition(async () => {
      setError(null);
      const res = await lookupOrder(orderNumber, contacto);
      if ("error" in res) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res.order);
        setMostrarForm(false);
      }
    });
  }

  return (
    <div className="mx-auto max-w-lg">
      {mostrarForm ? (
        <form onSubmit={onSubmit} className="space-y-3">
          {/* Sin ejemplo en el placeholder: el prefijo vive en la BD
              (settings.order_prefix) y repetirlo aquí sería una segunda fuente
              de verdad que se desincroniza. */}
          <input name="o" defaultValue={defaultOrder} placeholder="Número de pedido" required className={INPUT} />
          <input name="e" type="text" inputMode="email" autoComplete="email" placeholder="Correo o teléfono con el que compraste" required className={INPUT} />
          {error && (
            <div className="rounded-xl bg-accent-soft px-3.5 py-3 text-sm">
              <p className="text-accent">{error}</p>
              {activeBrand.legal.whatsapp && (
                <a href={`https://wa.me/${activeBrand.legal.whatsapp}?text=${encodeURIComponent("Hola, no encuentro mi pedido en la página de rastreo.")}`}
                  target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 font-medium text-text underline-offset-2 hover:underline">
                  <WhatsappLogo size={16} weight="fill" className="text-[#25D366]" /> Te lo buscamos por WhatsApp
                </a>
              )}
            </div>
          )}
          <button
            disabled={isPending}
            className="w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast disabled:bg-border disabled:text-muted"
          >
            {isPending ? "Buscando…" : "Rastrear pedido"}
          </button>
        </form>
      ) : (
        <button onClick={() => setMostrarForm(true)} className="text-xs text-muted underline-offset-2 hover:text-text hover:underline">
          Consultar otro pedido
        </button>
      )}

      {result && <Estado orden={result} />}
    </div>
  );
}

export function Estado({ orden: r }: { orden: TrackedOrder }) {
  const terminal = r.status === "cancelled" || r.status === "refunded";
  const paso = pasoCliente(r.status, r.stage, !!r.trackingNumber);
  const rastreoUrl = trackingUrlFor(r.carrier, r.trackingNumber, r.trackingUrl);
  const whatsapp = activeBrand.legal.whatsapp;
  const linkAyuda = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero saber de mi pedido ${r.orderNumber}`)}`
    : null;

  // ¿Cuándo llega? Ventana medida en pedidos reales; con envío, cuenta desde la salida.
  const ventana = r.paidAt && paso < 4 && (SOBRE_PEDIDO || r.shippedAt) ? ventanaEntrega(r.paidAt, r.shippedAt) : null;
  const atrasado = !!ventana && Date.now() > ventana.hasta.getTime();
  const diaFabrica = r.paidAt ? diasDesde(r.paidAt) : 0;

  const varios = r.items.reduce((n, i) => n + i.quantity, 0) > 1;
  const titular = terminal
    ? `Pedido ${r.status === "cancelled" ? "cancelado" : "reembolsado"}`
    : paso === 0 ? "Falta tu pago"
    : paso === 1 ? (SOBRE_PEDIDO ? (varios ? `Tus ${PLURAL} se están fabricando` : `Tu ${ITEM} se está fabricando`) : "Estamos preparando tu pedido")
    : paso === 2 ? "Tu pedido ya tiene guía"
    : paso === 3 ? "Tu pedido va en camino"
    : "Tu pedido fue entregado";

  const pasos = [
    { label: "Pagado", icon: CreditCard, fecha: fechaCorta(r.paidAt), detalle: null as string | null },
    {
      label: SOBRE_PEDIDO ? "Fabricación" : "Preparando",
      icon: SOBRE_PEDIDO ? Hammer : Package,
      fecha: null,
      detalle: SOBRE_PEDIDO
        ? `Día ${diaFabrica + 1} de ~${FABRICA_DIAS.tipico} · hecho a mano en León`
        : "Estamos preparando tu pedido",
    },
    { label: "Guía lista", icon: Package, fecha: null, detalle: "La paquetería lo recoge en 24 a 48 horas" },
    {
      label: "En camino",
      icon: Truck,
      fecha: fechaCorta(r.shippedAt),
      detalle: r.carrier ? `Va con ${carrierName(r.carrier)}` : "Va con la paquetería",
    },
    { label: "Entregado", icon: HouseLine, fecha: fechaCorta(r.deliveredAt), detalle: null },
  ];
  const IconoActual = terminal ? XCircle : paso === 0 ? CreditCard : pasos[paso].icon;
  // Avance de la barra: completo hasta el paso actual, medio tramo hacia el siguiente.
  const avance = paso >= 4 ? 100 : Math.min(100, (paso / 4) * 100 + (paso > 0 ? 12.5 : 0));

  return (
    <div className="mt-6 space-y-4">
      {/* 1. dónde va y cuándo llega */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between text-sm text-muted">
          <span className="nums">{r.orderNumber}</span>
          <span className="nums">{mxn(r.totalCents)}</span>
        </div>
        <div className="mt-3 flex items-center gap-3.5">
          <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${terminal ? "bg-border text-muted" : paso >= 4 ? "bg-[#1f3a2a] text-[#5fd08a]" : "bg-accent text-accent-contrast"}`}>
            <IconoActual size={28} weight="fill" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight tracking-tight">{titular}</h2>
            {!terminal && paso > 0 && paso < 4 && pasos[paso].detalle && <p className="mt-0.5 text-sm text-muted">{pasos[paso].detalle}</p>}
          </div>
        </div>

        {ventana && !atrasado && (
          <p className="mt-3 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm">
            Llega <span className="font-semibold">{ventana.texto}</span>
          </p>
        )}
        {atrasado && (
          <div className="mt-3 flex gap-2.5 rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-3 text-sm">
            <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="font-semibold">Va más lento de lo previsto</p>
              <p className="mt-0.5 text-muted">Lo estimamos para {ventana?.texto}. Escríbenos y te decimos exactamente en qué va.</p>
            </div>
          </div>
        )}
        {r.estimatedDelivery && !ventana && paso < 4 && (
          <p className="mt-3 text-sm text-muted">Entrega estimada: <span className="text-text">{fechaEntrega(r.estimatedDelivery)}</span></p>
        )}

        {/* línea de tiempo: barra de avance + una parada por etapa */}
        {!terminal && paso > 0 && (
          <div className="mt-6">
            <div className="relative mx-[10%]">
              <div className="h-1.5 rounded-full bg-border" />
              <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-700" style={{ width: `${avance}%` }} />
            </div>
            <ol className="-mt-[22px] grid grid-cols-5">
              {pasos.map((p, i) => {
                const hecho = i < paso || paso === 4;
                const actual = i === paso && paso < 4;
                const Icono = p.icon;
                return (
                  <li key={p.label} className="flex flex-col items-center text-center">
                    <span
                      className={`relative grid h-10 w-10 place-items-center rounded-full border-2 ${
                        hecho ? "border-accent bg-accent text-accent-contrast" : actual ? "border-accent bg-surface text-accent" : "border-border bg-surface text-muted"
                      }`}
                    >
                      {actual && <span className="absolute inset-0 animate-ping rounded-full border-2 border-accent opacity-40" aria-hidden />}
                      {hecho ? <Check size={18} weight="bold" /> : <Icono size={18} weight={actual ? "fill" : "regular"} />}
                    </span>
                    <span className={`mt-1.5 text-[11px] leading-tight sm:text-xs ${hecho || actual ? "font-medium text-text" : "text-muted"}`}>{p.label}</span>
                    {p.fecha && (hecho || actual) && <span className="nums text-[10px] text-muted sm:text-[11px]">{p.fecha}</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {/* 2. la guía, con salida directa a la paquetería */}
      {!terminal && r.trackingNumber && (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Tu guía</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted">{carrierName(r.carrier) ?? "Paquetería"}</span>
            <span className="nums font-medium">{r.trackingNumber}</span>
          </p>
          {r.sucursal && <p className="mt-1 text-xs text-muted">Recoge tu paquete en: <span className="text-text">{r.sucursal}</span></p>}
          {rastreoUrl && (
            <a href={rastreoUrl} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast">
              Seguir con la paquetería <ArrowSquareOut size={14} weight="bold" />
            </a>
          )}
        </div>
      )}

      {r.status === "pending" && r.payment && (
        <div className="rounded-2xl bg-accent-soft p-4 text-sm">
          <p className="font-medium text-accent">Falta tu pago</p>
          {r.payment.reference && <p className="nums mt-1 text-muted">Referencia de pago en efectivo: {r.payment.reference}</p>}
          {r.payment.clabe && <p className="nums mt-1 text-muted">CLABE SPEI: {r.payment.clabe}</p>}
          {r.payment.voucherUrl && (
            <a href={r.payment.voucherUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-accent underline">Ver comprobante</a>
          )}
          <a href={`/pedido/${r.orderNumber}/pagar`} className="mt-2 block font-semibold text-accent underline">Pagar ahora →</a>
        </div>
      )}

      {/* Garantía en curso: lo más importante para el cliente es SU parte —
          la etiqueta de retorno que debe imprimir y con qué paquetería regresarlo. */}
      {r.garantia && (
        <div className="rounded-2xl border border-accent/40 bg-accent-soft/60 p-4 text-sm">
          <p className="font-semibold text-accent">Garantía en proceso{r.garantia.cerrada ? " — resuelta" : ""}</p>
          <p className="mt-0.5 text-xs text-muted">{r.garantia.razon}</p>
          {r.garantia.retorno && (
            <div className="mt-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Tu envío de regreso</p>
              <p className="mt-1">
                <span className="capitalize text-muted">{r.garantia.retorno.carrier ?? "Paquetería"}</span>{" "}
                <span className="nums font-medium">{r.garantia.retorno.tracking}</span>
              </p>
              {r.garantia.retorno.label && (
                <a href={r.garantia.retorno.label} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium text-accent underline">
                  Descarga tu etiqueta, pégala en la caja y entrégala en la paquetería →
                </a>
              )}
              {r.garantia.recibido && <p className="mt-1 text-xs text-muted">✓ Ya lo recibimos en bodega.</p>}
            </div>
          )}
          {r.garantia.repo && (
            <div className="mt-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Tu reposición en camino</p>
              <p className="mt-1">
                <span className="capitalize text-muted">{r.garantia.repo.carrier ?? "Paquetería"}</span>{" "}
                <span className="nums font-medium">{r.garantia.repo.tracking}</span>
              </p>
              {(() => {
                const u = trackingUrlFor(r.garantia.repo.carrier, r.garantia.repo.tracking, r.garantia.repo.url);
                return u ? <a href={u} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium text-accent underline">Rastrear con la paquetería →</a> : null;
              })()}
            </div>
          )}
          {!r.garantia.retorno && !r.garantia.cerrada && (
            <p className="mt-2 text-xs text-muted">Estamos generando tu guía de regreso; aparecerá aquí.</p>
          )}
        </div>
      )}

      {/* Solo pedidos entregados pueden reseñarse (lo valida también el servidor). */}
      {!terminal && r.reviewToken && r.deliveredAt && (
        <a href={`/resena/${r.reviewToken}`} className="block rounded-2xl bg-accent-soft p-3 text-center text-sm font-semibold text-accent">
          ¿Cómo te quedaron? Deja tu reseña →
        </a>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{ITEMS_ORDERED}</p>
        <ul className="mt-1.5 space-y-1 text-sm text-muted">
          {r.items.map((it, i) => (
            <li key={i} className="capitalize">{it.name} × {it.quantity}</li>
          ))}
        </ul>
        {r.shipping && (r.shipping.name || r.shipping.line1) && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Datos de envío</p>
            <div className="mt-1.5 text-sm text-muted">
              {r.shipping.name && <p className="text-text">{r.shipping.name}</p>}
              {r.shipping.phone && <p className="nums">{r.shipping.phone}</p>}
              <p className="leading-relaxed">
                {[r.shipping.line1, r.shipping.neighborhood, r.shipping.city, r.shipping.region, r.shipping.postal].filter(Boolean).join(", ")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. a quién le pregunto — con el número de pedido ya escrito */}
      {linkAyuda && (
        <a href={linkAyuda} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-medium transition-colors hover:border-text">
          <WhatsappLogo size={18} weight="fill" className="text-[#25D366]" />
          ¿Dudas? Escríbenos por WhatsApp
        </a>
      )}
    </div>
  );
}
