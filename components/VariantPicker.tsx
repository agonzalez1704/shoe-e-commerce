"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsString } from "nuqs";
import { ShoppingBag } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { addToCart } from "@/app/cart/actions";
import { trackMeta } from "@/components/MetaPixel";
import { metaContentId } from "@/lib/meta-content";
import { activeBrand } from "@/lib/brand";

type Variant = {
  id: string;
  sku: string;
  // null on categories that don't come in sizes — a scooter, a helmet. Those
  // products carry one variant per colourway and nothing to pick.
  size_value: string | null;
  size_system: string | null;
  width: string | null;
  color: string;
  price_cents: number | null;
  qty_available: number;
};

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export function VariantPicker({
  slug,
  variants,
  basePriceCents,
  color,
  onColorChange,
  madeToOrder = false,
}: {
  slug: string;
  variants: Variant[];
  basePriceCents: number;
  color: string;
  onColorChange: (c: string) => void;
  madeToOrder?: boolean;
}) {
  const colors = useMemo(() => Array.from(new Set(variants.map((v) => v.color))), [variants]);
  // The size lives in the URL (?talla=26.5) so a link can carry a ready-to-buy
  // selection. Store the size value, not the variant id: it stays readable and
  // survives a variant being re-created.
  const [size, setSize] = useQueryState("talla", parseAsString.withOptions({ history: "replace" }));
  const [flash, setFlash] = useState(false); // pulse the size picker when tapped without a size
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Does this product come in sizes at all? Drives whether there is a step
  // between picking a colour and buying.
  const sized = useMemo(() => variants.some((v) => v.size_value !== null), [variants]);

  const sizes = useMemo(
    () =>
      variants
        .filter((v) => v.color === color)
        .sort((a, b) => parseFloat(a.size_value ?? "0") - parseFloat(b.size_value ?? "0")),
    [variants, color],
  );

  // Sized: a size only counts when this colour actually offers it, in stock.
  // Unsized: the colourway *is* the choice, so it is selected the moment the
  // colour is — otherwise the buy button would never enable.
  const inStock = (v: Variant) => madeToOrder || v.qty_available > 0;
  const selected = useMemo(
    () =>
      sized
        ? (sizes.find((v) => v.size_value === size && inStock(v)) ?? null)
        : (sizes.find(inStock) ?? sizes[0] ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sized, sizes, size, madeToOrder],
  );
  const price = selected?.price_cents ?? basePriceCents;
  const soldOut = !madeToOrder && !!selected && selected.qty_available <= 0;
  // "Selecciona una talla" is a lie on a scooter — there is nothing to select.
  const ctaLabel = soldOut
    ? "Agotado"
    : selected
      ? "Agregar al carrito"
      : sized
        ? "Selecciona una talla"
        : "Agotado";
  const canBuy = !!selected && !isPending && (madeToOrder || selected.qty_available > 0);

  const add = () => {
    if (!selected) {
      // nothing to nudge them towards when there is no size step
      if (!sized) return;
      document.getElementById("size-picker")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setFlash(true);
      setTimeout(() => setFlash(false), 1400);
      return;
    }
    startTransition(async () => {
      await addToCart(selected.id, 1);
      trackMeta("AddToCart", {
        content_ids: [metaContentId(slug, selected.color)],
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
                // keep the size across colourways when it exists there, drop it otherwise
                if (!variants.some((v) => v.color === c && v.size_value === size)) setSize(null);
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

      {/* size + width — absent entirely on unsized categories */}
      {sized && (
      <fieldset id="size-picker" className={`mt-7 scroll-mt-24 rounded-xl transition-all ${flash ? "bg-accent-soft/60 ring-2 ring-accent p-3 -m-3" : "ring-0"}`}>
        <div className="flex items-center justify-between">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted">Talla</legend>
          <a href="#size-guide" className="text-xs text-muted underline-offset-2 transition-colors hover:text-accent hover:underline">Guía de tallas</a>
        </div>
        {activeBrand.pdp?.sizeHint && (
          <p className="mt-1 text-xs text-muted">{activeBrand.pdp.sizeHint}</p>
        )}
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {sizes.map((v) => {
            // made-to-order: never out of stock, no availability shown
            const oos = !madeToOrder && v.qty_available <= 0;
            const low = !madeToOrder && !oos && v.qty_available <= 3;
            const active = v.size_value === size;
            return (
              <button
                key={v.id}
                disabled={oos}
                onClick={() => setSize(v.size_value)}
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
      )}

      {/* unsized: the stock line has no fieldset to live in */}
      {!sized && !madeToOrder && selected && selected.qty_available > 0 && selected.qty_available <= 3 && (
        <p className="mt-4 text-xs text-accent">Últimas {selected.qty_available} piezas</p>
      )}

      <div className="mt-7 flex items-center justify-between">
        <p className="nums text-xl font-medium">{mxn(price)}</p>
      </div>

      <button
        disabled={isPending || (!!selected && !madeToOrder && selected.qty_available <= 0)}
        onClick={add}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-medium text-accent-contrast transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-border disabled:text-muted"
      >
        <ShoppingBag size={18} weight="bold" />
        {isPending ? "Agregando…" : ctaLabel}
      </button>

      {/* mobile sticky add-to-cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="min-w-0">
          <p className="nums text-base font-semibold leading-none">{mxn(price)}</p>
          <p className="truncate text-[11px] capitalize text-muted">
            {sized ? (selected ? `Talla ${selected.size_value}` : "Elige tu talla") : color}
          </p>
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
