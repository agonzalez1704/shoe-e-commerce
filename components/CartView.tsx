"use client";

import { AvisoPedidoCarrito } from "@/components/PedidoReciente";
import Link from "next/link";
import Image from "next/image";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash, ShoppingBag, ArrowsClockwise, Truck, Tag } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { updateCartItem, removeFromCart, type CartSummary, type CartLine } from "@/app/cart/actions";
import { notifyCartChanged } from "@/components/CartBadge";
import { activeBrand } from "@/lib/brand";

const COPY = activeBrand.copy ?? {};

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

// Both lines are brand promises, not cart mechanics. A store that has not
// settled its exchange policy or its lead time shows neither, rather than
// inheriting a shoemaker's.
function MadeToOrderNotice() {
  const { exchangeLine, deliveryLine } = COPY;
  if (!exchangeLine) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3.5">
      <ArrowsClockwise size={22} weight="bold" className="mt-0.5 shrink-0 text-accent" />
      <div className="text-sm">
        <p className="font-medium">{activeBrand.pdp?.reassurance?.title ?? "Cambios y devoluciones"}</p>
        <p className="mt-0.5 text-muted">{[exchangeLine, deliveryLine].filter(Boolean).join(" ")}</p>
      </div>
    </div>
  );
}

// quantity 0 = quitar la linea
type Cambio = { variantId: string; quantity: number };

function aplicarCambio(lines: CartLine[], c: Cambio): CartLine[] {
  if (c.quantity <= 0) return lines.filter((l) => l.variantId !== c.variantId);
  return lines.map((l) =>
    l.variantId === c.variantId ? { ...l, quantity: c.quantity, lineTotalCents: l.unitPriceCents * c.quantity } : l,
  );
}

export function CartView({ initial }: { initial: CartSummary }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // Quitar/cambiar cantidad se ve al instante; si la accion falla, React
  // regresa a lo que diga el servidor. El descuento del combo y el total los
  // calcula el servidor: mientras llegan se muestran atenuados.
  const [lines, aplicar] = useOptimistic(initial.lines, aplicarCambio);
  const subtotal = lines.reduce((n, l) => n + l.lineTotalCents, 0);

  const cambiar = (c: Cambio) =>
    startTransition(async () => {
      aplicar(c);
      if (c.quantity <= 0) await removeFromCart(c.variantId);
      else await updateCartItem(c.variantId, c.quantity);
      notifyCartChanged();
      router.refresh();
    });

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border px-4 py-20 text-center">
        <AvisoPedidoCarrito />
        <ShoppingBag size={32} className="text-muted" />
        <p className="text-muted">Tu carrito está vacío.</p>
        <Link
          href="/products"
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast"
        >
          Ver tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MadeToOrderNotice />

      {initial.comboNudges.length > 0 && (
        <div className="rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm">
            <Tag size={20} weight="fill" className="shrink-0 text-accent" />
            Agrega {initial.comboNudges[0].needed} par
            {initial.comboNudges[0].needed > 1 ? "es" : ""} más del combo y ahorra{" "}
            <span className="font-semibold text-accent">{mxn(initial.comboNudges[0].savingsCents)}</span>.
          </p>
          {initial.comboSuggestions.length > 0 && (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {initial.comboSuggestions.map((s) => (
                <Link
                  key={s.slug}
                  href={`/products/${s.slug}`}
                  className="group flex w-36 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-accent"
                >
                  <div className="aspect-square overflow-hidden bg-elevated">
                    {s.image && (
                      <Image
                        src={s.image}
                        alt={s.name}
                        width={192}
                        height={192}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-xs font-medium">{s.name}</p>
                    <p className="nums mt-0.5 text-xs text-muted">{mxn(s.priceCents)}</p>
                    <span className="mt-1.5 block text-xs font-semibold text-accent group-hover:underline">Agregar →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-10 md:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-border">
          {lines.map((l) => (
            <li key={l.variantId} className="flex gap-4 py-6 first:pt-0 sm:gap-5">
              <Link
                href={`/products/${l.slug}`}
                className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-elevated sm:h-32 sm:w-32"
              >
                {l.image && (
                  <Image
                    src={l.image}
                    alt={l.productName}
                    width={256}
                    height={256}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                )}
              </Link>

              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/products/${l.slug}`} className="text-base font-medium leading-tight transition-colors hover:text-accent">
                      {l.productName}
                    </Link>
                    <p className="mt-1 text-sm capitalize text-muted">{l.label}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                      <ArrowsClockwise size={12} weight="fill" className="text-accent" /> Primer cambio de talla sin costo
                    </p>
                  </div>
                  <p className="nums shrink-0 text-base font-semibold">{mxn(l.lineTotalCents)}</p>
                </div>

                <div className="mt-auto flex items-center gap-3 pt-4">
                  <select
                    value={l.quantity}
                    onChange={(e) => cambiar({ variantId: l.variantId, quantity: Number(e.target.value) })}
                    className="nums rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                  >
                    {Array.from({ length: Math.max(l.qtyAvailable, l.quantity) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => cambiar({ variantId: l.variantId, quantity: 0 })}
                    aria-label="Quitar"
                    className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
                  >
                    <Trash size={14} /> Quitar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside aria-busy={isPending} className="h-fit space-y-4 rounded-2xl border border-border bg-surface p-5 md:sticky md:top-24">
          <h2 className="text-sm font-semibold">Resumen</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Subtotal (IVA incl.)</span>
            <span className="nums font-medium">{mxn(subtotal)}</span>
          </div>
          {initial.comboDiscountCents > 0 && (
            <div className={`flex justify-between text-sm transition-opacity ${isPending ? "opacity-40" : ""}`}>
              <span className="flex items-center gap-1 text-accent">
                <Tag size={14} weight="fill" /> Descuento combo
              </span>
              <span className="nums font-medium text-accent">−{mxn(initial.comboDiscountCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted">Envío</span>
            <span className="font-medium text-accent">Gratis</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="font-semibold">Total</span>
            <span className={`nums text-xl font-semibold transition-opacity ${isPending ? "animate-pulse opacity-40" : ""}`}>
              {mxn(initial.totalCents)}
            </span>
          </div>

          {COPY.deliveryLine && (
            <p className="flex items-start gap-1.5 rounded-lg bg-elevated px-3 py-2 text-xs text-muted">
              <Truck size={14} className="mt-0.5 shrink-0" />
              {COPY.deliveryLine}
            </p>
          )}

          {/* Hasta que el servidor confirme el cambio: el checkout leeria el carrito viejo. */}
          <Link
            href="/checkout"
            aria-disabled={isPending}
            className="block rounded-full aria-disabled:pointer-events-none aria-disabled:opacity-60 bg-accent px-6 py-3.5 text-center text-sm font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-transform active:scale-[0.99]"
          >
            Continuar al pago
          </Link>
        </aside>
      </div>
    </div>
  );
}
