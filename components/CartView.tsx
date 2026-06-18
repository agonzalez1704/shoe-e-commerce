"use client";

import Link from "next/link";
import Image from "next/image";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash, ShoppingBag } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { updateCartItem, removeFromCart, type CartSummary } from "@/app/cart/actions";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

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
    <div className="grid gap-10 md:grid-cols-[1fr_340px]">
      <ul className="divide-y divide-border">
        {initial.lines.map((l) => (
          <li key={l.variantId} className="flex gap-4 py-5">
            <Link href={`/products/${l.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-elevated">
              {l.image && (
                <Image src={l.image} alt={l.productName} width={96} height={96} className="h-full w-full object-cover" />
              )}
            </Link>
            <div className="flex flex-1 flex-col">
              <Link href={`/products/${l.slug}`} className="text-sm font-medium">{l.productName}</Link>
              <p className="mt-0.5 text-xs capitalize text-muted">{l.label}</p>
              <div className="mt-auto flex items-center gap-3 pt-3">
                <select
                  value={l.quantity}
                  disabled={isPending}
                  onChange={(e) => act(() => updateCartItem(l.variantId, Number(e.target.value)))}
                  className="nums rounded-lg border border-border bg-surface px-2 py-1 text-sm"
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
            <p className="nums text-sm font-medium">{mxn(l.lineTotalCents)}</p>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-2xl border border-border bg-surface p-5 md:sticky md:top-24">
        <h2 className="text-sm font-medium">Resumen</h2>
        <div className="mt-4 flex justify-between text-sm">
          <span className="text-muted">Subtotal (IVA incl.)</span>
          <span className="nums font-medium">{mxn(initial.subtotalCents)}</span>
        </div>
        <p className="mt-1 text-xs text-muted">Envío calculado en el siguiente paso.</p>
        <Link
          href="/checkout"
          className="mt-5 block rounded-full bg-accent px-6 py-3.5 text-center text-sm font-medium text-accent-contrast transition-transform active:scale-[0.99]"
        >
          Continuar al pago
        </Link>
      </aside>
    </div>
  );
}
