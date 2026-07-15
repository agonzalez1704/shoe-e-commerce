"use client";

import Link from "next/link";
import Image from "next/image";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash, ShoppingBag, Package, Truck, Tag } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { updateCartItem, removeFromCart, type CartSummary } from "@/app/cart/actions";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

function MadeToOrderNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3.5">
      <Package size={22} weight="bold" className="mt-0.5 shrink-0 text-accent" />
      <div className="text-sm">
        <p className="font-medium">Hecho sobre pedido</p>
        <p className="mt-0.5 text-muted">
          Cada par se fabrica especialmente para ti cuando lo compras. Entrega estimada de{" "}
          <span className="font-medium text-text">4 a 7 días hábiles</span> a todo México.
        </p>
      </div>
    </div>
  );
}

export function CartView({ initial }: { initial: CartSummary }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (initial.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border py-20 text-center">
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

  const act = (fn: () => Promise<void>) => startTransition(async () => { await fn(); router.refresh(); });

  return (
    <div className="space-y-6">
      <MadeToOrderNotice />

      <div className="grid gap-10 md:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-border">
          {initial.lines.map((l) => (
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
                      <Package size={12} weight="fill" className="text-accent" /> Se fabrica sobre pedido
                    </p>
                  </div>
                  <p className="nums shrink-0 text-base font-semibold">{mxn(l.lineTotalCents)}</p>
                </div>

                <div className="mt-auto flex items-center gap-3 pt-4">
                  <select
                    value={l.quantity}
                    disabled={isPending}
                    onChange={(e) => act(() => updateCartItem(l.variantId, Number(e.target.value)))}
                    className="nums rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                  >
                    {Array.from({ length: Math.max(l.qtyAvailable, l.quantity) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <button
                    disabled={isPending}
                    onClick={() => act(() => removeFromCart(l.variantId))}
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

        <aside className="h-fit space-y-4 rounded-2xl border border-border bg-surface p-5 md:sticky md:top-24">
          <h2 className="text-sm font-semibold">Resumen</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Subtotal (IVA incl.)</span>
            <span className="nums font-medium">{mxn(initial.subtotalCents)}</span>
          </div>
          {initial.comboDiscountCents > 0 && (
            <div className="flex justify-between text-sm">
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
            <span className="nums text-xl font-semibold">{mxn(initial.totalCents)}</span>
          </div>

          <p className="flex items-start gap-1.5 rounded-lg bg-elevated px-3 py-2 text-xs text-muted">
            <Truck size={14} className="mt-0.5 shrink-0" />
            Se fabrica al comprar · entrega en 4 a 7 días hábiles a todo México.
          </p>

          <Link
            href="/checkout"
            className="block rounded-full bg-accent px-6 py-3.5 text-center text-sm font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-transform active:scale-[0.99]"
          >
            Continuar al pago
          </Link>
        </aside>
      </div>
    </div>
  );
}
