"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag, ShoppingBag, CheckCircle, ArrowRight } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { swatchBg } from "@/lib/colors";
import { addToCart } from "@/app/cart/actions";
import type { ProductDetail } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

type Slot = { color: string; variantId: string | null };

// Interactive combo builder: pick `minQty` pairs (any colour of this model),
// see the bundle price + savings live, add them all in one click. The cart /
// order RPC apply the same discount server-side.
export function ComboBuilder({
  product,
  minQty,
  comboPriceCents,
  initialColor,
}: {
  product: ProductDetail;
  minQty: number;
  comboPriceCents: number;
  initialColor: string;
}) {
  const colors = useMemo(
    () => Array.from(new Set(product.variants.map((v) => v.color))),
    [product.variants],
  );
  const base = product.base_price_cents;
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: minQty }, () => ({ color: initialColor || colors[0] || "", variantId: null })),
  );
  const [pending, start] = useTransition();
  const router = useRouter();

  const sizesFor = (color: string) =>
    product.variants
      .filter((v) => v.color === color)
      .sort((a, b) => parseFloat(a.size_value) - parseFloat(b.size_value));

  const colorPrice = (color: string) =>
    product.variants.find((v) => v.color === color && v.price_cents != null)?.price_cents ?? base;

  const setSlot = (i: number, patch: Partial<Slot>) =>
    setSlots((s) => s.map((sl, j) => (j === i ? { ...sl, ...patch } : sl)));

  const chosen = slots.filter((s) => s.variantId).length;
  const allChosen = chosen === minQty;
  const normalTotal = slots.reduce((sum, s) => sum + colorPrice(s.color), 0);
  const savings = normalTotal - comboPriceCents;

  const addCombo = () =>
    start(async () => {
      for (const s of slots) if (s.variantId) await addToCart(s.variantId, 1);
      router.push("/cart");
    });

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent-soft to-transparent">
      <div className="flex items-center justify-between gap-3 border-b border-accent/20 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Tag size={17} weight="fill" className="text-accent" />
          Combo {minQty} pares — <span className="text-accent">{mxn(comboPriceCents)}</span>
        </p>
        {savings > 0 && (
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-contrast">
            Ahorra {mxn(savings)}
          </span>
        )}
      </div>

      <div className="space-y-4 px-4 py-4">
        <p className="text-xs text-muted">
          Llévate {minQty} pares de {product.name} (elige los colores y tallas que quieras) y paga solo{" "}
          <span className="font-medium text-text">{mxn(comboPriceCents)}</span>.
        </p>

        {slots.map((slot, i) => {
          const sizes = sizesFor(slot.color);
          return (
            <div key={i} className="rounded-xl border border-border bg-surface/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Par {i + 1}</span>
                {slot.variantId && <CheckCircle size={16} weight="fill" className="text-accent" />}
              </div>

              {/* colours */}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {colors.map((c) => {
                  const active = c === slot.color;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSlot(i, { color: c, variantId: null })}
                      className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs capitalize transition-colors ${
                        active ? "border-accent text-accent" : "border-border text-muted hover:text-text"
                      }`}
                    >
                      <span
                        className="h-4 w-4 rounded-full ring-1 ring-inset ring-border"
                        style={{ background: swatchBg(c) }}
                      />
                      {c}
                    </button>
                  );
                })}
              </div>

              {/* sizes */}
              <div className="mt-2.5 grid grid-cols-6 gap-1.5">
                {sizes.map((v) => {
                  const active = v.id === slot.variantId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSlot(i, { variantId: v.id })}
                      className={`nums rounded-lg border py-1.5 text-xs transition-colors ${
                        active
                          ? "border-accent bg-accent text-accent-contrast"
                          : "border-border text-muted hover:border-accent hover:text-text"
                      }`}
                    >
                      {v.size_value}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="text-xs text-muted line-through">{mxn(normalTotal)}</p>
            <p className="nums text-xl font-semibold text-accent">{mxn(comboPriceCents)}</p>
          </div>
          <button
            type="button"
            disabled={!allChosen || pending}
            onClick={addCombo}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? (
              "Agregando…"
            ) : allChosen ? (
              <>
                <ShoppingBag size={16} weight="bold" /> Agregar combo
              </>
            ) : (
              <>
                Elige {minQty - chosen} {minQty - chosen === 1 ? "talla" : "tallas"} <ArrowRight size={14} weight="bold" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
