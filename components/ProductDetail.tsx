"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Package, Truck } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { ProductImage } from "@/components/ProductImage";
import { VariantPicker } from "@/components/VariantPicker";
import { Stars } from "@/components/Stars";
import type { ProductDetail as Product } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export function ProductDetail({
  product,
  rating,
}: {
  product: Product;
  rating?: { average: number; count: number };
}) {
  const colors = useMemo(
    () => Array.from(new Set(product.variants.map((v) => v.color))),
    [product.variants],
  );
  const [color, setColor] = useState(colors[0] ?? "");

  // images for the chosen color + any general (null-color) shots; fallback to all
  const gallery = useMemo(() => {
    const matched = product.images.filter((i) => i.color === color || i.color == null);
    return matched.length ? matched : product.images;
  }, [product.images, color]);

  const [hero, ...rest] = gallery;

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      <div className="grid grid-cols-2 gap-3">
        {hero && (
          <div className="col-span-2 aspect-square overflow-hidden rounded-2xl bg-elevated">
            <ProductImage
              src={hero.url}
              alt={hero.alt ?? product.name}
              slug={product.slug}
              width={800}
              height={800}
              priority
              className="h-full w-full object-cover"
            />
          </div>
        )}
        {rest.map((img, i) => (
          <div key={i} className="aspect-square overflow-hidden rounded-xl bg-elevated">
            <Image
              src={img.url}
              alt={img.alt ?? product.name}
              width={400}
              height={400}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

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
              Se fabrica para ti. Envío en 3-5 días hábiles a todo México.
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
