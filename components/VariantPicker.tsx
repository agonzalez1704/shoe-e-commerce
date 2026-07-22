"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { addToCart } from "@/app/cart/actions";
import { trackMeta } from "@/components/MetaPixel";

type Variant = {
  id: string;
  sku: string;
  size_value: string;
  size_system: string;
  width: string;
  color: string;
  price_cents: number | null;
  qty_available: number;
};

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export function VariantPicker({
  variants,
  basePriceCents,
  color,
  onColorChange,
  madeToOrder = false,
}: {
  variants: Variant[];
  basePriceCents: number;
  color: string;
  onColorChange: (c: string) => void;
  madeToOrder?: boolean;
}) {
  const colors = useMemo(() => Array.from(new Set(variants.map((v) => v.color))), [variants]);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const sizes = useMemo(
    () =>
      variants
        .filter((v) => v.color === color)
        .sort((a, b) => parseFloat(a.size_value) - parseFloat(b.size_value)),
    [variants, color],
  );

  const selected = variants.find((v) => v.id === variantId) ?? null;
  const price = selected?.price_cents ?? basePriceCents;
  const canBuy = !!selected && !isPending && (madeToOrder || selected.qty_available > 0);

  const add = () => {
    if (!selected) {
      document.getElementById("size-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    startTransition(async () => {
      await addToCart(selected.id, 1);
      trackMeta("AddToCart", {
        content_ids: [selected.sku],
        content_type: "product",
        value: (selected.price_cents ?? basePriceCents) / 100,
        currency: "MXN",
      });
      router.push("/cart");
    });
  };

  return (
    <div className="mt-8">
      {/* color */}
      <fieldset>
        <legend className="text-xs font-medium uppercase tracking-wide text-muted">
          Color — <span className="text-text">{color}</span>
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => {
                onColorChange(c);
                setVariantId(null);
              }}
              className={`rounded-full border px-4 py-1.5 text-sm capitalize transition-colors ${
                c === color ? "border-accent text-accent" : "border-border text-muted hover:text-text"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      {/* size + width */}
      <fieldset id="size-picker" className="mt-7 scroll-mt-24">
        <div className="flex items-center justify-between">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted">Talla</legend>
          <a href="#size-guide" className="text-xs text-muted underline-offset-2 transition-colors hover:text-accent hover:underline">Guía de tallas</a>
        </div>
        <p className="mt-1 text-xs text-muted">Queda fiel a tu talla — pide tu número habitual.</p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {sizes.map((v) => {
            // made-to-order: never out of stock, no availability shown
            const oos = !madeToOrder && v.qty_available <= 0;
            const low = !madeToOrder && !oos && v.qty_available <= 3;
            const active = v.id === variantId;
            return (
              <button
                key={v.id}
                disabled={oos}
                onClick={() => setVariantId(v.id)}
                title={`Ancho ${v.width}${low ? ` · quedan ${v.qty_available}` : ""}`}
                className={`relative rounded-lg border py-2.5 text-center text-sm transition-colors ${
                  active
                    ? "border-text bg-text text-bg"
                    : oos
                      ? "cursor-not-allowed border-border text-muted/40 line-through"
                      : "border-border hover:border-text"
                }`}
              >
                <span className="nums block font-medium">{v.size_system} {v.size_value}</span>
                <span className="block text-[10px] capitalize opacity-60">{v.width}</span>
                {low && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
        {!madeToOrder && selected && selected.qty_available <= 3 && (
          <p className="mt-2 text-xs text-accent">Últimas {selected.qty_available} piezas</p>
        )}
      </fieldset>

      <div className="mt-7 flex items-center justify-between">
        <p className="nums text-xl font-medium">{mxn(price)}</p>
      </div>

      <button
        disabled={isPending || (!!selected && !madeToOrder && selected.qty_available <= 0)}
        onClick={add}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-medium text-accent-contrast transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-border disabled:text-muted"
      >
        <ShoppingBag size={18} weight="bold" />
        {isPending ? "Agregando…" : selected ? "Agregar al carrito" : "Selecciona una talla"}
      </button>

      {/* mobile sticky add-to-cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="min-w-0">
          <p className="nums text-base font-semibold leading-none">{mxn(price)}</p>
          <p className="truncate text-[11px] text-muted">{selected ? `Talla ${selected.size_value}` : "Elige tu talla"}</p>
        </div>
        <button
          disabled={isPending || (!!selected && !madeToOrder && selected.qty_available <= 0)}
          onClick={add}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <ShoppingBag size={16} weight="bold" />
          {isPending ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </div>
  );
}
