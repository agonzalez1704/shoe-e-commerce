"use client";

import { useMemo, useState } from "react";
import { Package, Truck, Tag } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { comboOf, comboLabel } from "@/lib/pricing";
import { ZoomImage } from "@/components/ZoomImage";
import { Lightbox } from "@/components/Lightbox";
import { VariantPicker } from "@/components/VariantPicker";
import { Stars } from "@/components/Stars";
import type { ProductDetail as Product } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export function ProductDetail({
  product,
  rating,
  initialColor,
}: {
  product: Product;
  rating?: { average: number; count: number };
  initialColor?: string;
}) {
  const colors = useMemo(
    () => Array.from(new Set(product.variants.map((v) => v.color))),
    [product.variants],
  );
  const [color, setColor] = useState(
    () => (initialColor && colors.includes(initialColor) ? initialColor : colors[0]) ?? "",
  );

  // images for the chosen color + any general (null-color) shots; fallback to all
  const gallery = useMemo(() => {
    const matched = product.images.filter((i) => i.color === color || i.color == null);
    return matched.length ? matched : product.images;
  }, [product.images, color]);

  const [hero, ...rest] = gallery;
  const [lightbox, setLightbox] = useState<number | null>(null);
  const combo = comboOf(product.comboMinQty, product.comboPriceCents);

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      <div className="grid grid-cols-2 gap-3">
        {hero && (
          <div className="col-span-2 aspect-square overflow-hidden rounded-2xl border border-border bg-elevated">
            <ZoomImage src={hero.url} alt={hero.alt ?? product.name} priority onClick={() => setLightbox(0)} />
          </div>
        )}
        {rest.map((img, i) => (
          <div key={i} className="aspect-square overflow-hidden rounded-xl border border-border bg-elevated">
            <ZoomImage src={img.url} alt={img.alt ?? product.name} onClick={() => setLightbox(i + 1)} />
          </div>
        ))}
      </div>

      {lightbox !== null && (
        <Lightbox
          images={gallery}
          index={lightbox}
          name={product.name}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}

      <div className="md:sticky md:top-24 md:h-fit">
        {product.brand && <p className="text-sm uppercase tracking-wide text-muted">{product.brand}</p>}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{product.name}</h1>
        {rating && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Stars value={rating.average} />
            <span className="nums">{rating.average.toFixed(1)} · {rating.count} reseñas</span>
          </p>
        )}
        <p className="nums mt-3 text-2xl font-medium">{mxn(product.base_price_cents)}</p>
        <p className="mt-1 text-xs text-muted">Precio con IVA incluido</p>
        {combo && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">
            <Tag size={15} weight="fill" />
            Llévate {combo.minQty} por {mxn(combo.priceCents)}
            <span className="text-xs font-normal text-muted">({comboLabel(combo, mxn)})</span>
          </p>
        )}
        {product.description && (
          <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted">{product.description}</p>
        )}

        {product.made_to_order && (
          <div className="mt-6 space-y-2 rounded-xl border border-border bg-elevated p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Package size={18} weight="bold" className="text-accent" />
              Hecho sobre pedido
            </p>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Truck size={18} className="shrink-0" />
              Se fabrica para ti. Envío en 4-7 días hábiles a todo México.
            </p>
          </div>
        )}

        <VariantPicker
          variants={product.variants}
          basePriceCents={product.base_price_cents}
          color={color}
          onColorChange={setColor}
          madeToOrder={product.made_to_order}
        />
      </div>
    </div>
  );
}
