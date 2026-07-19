"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Package, Truck, ShieldCheck, ArrowsClockwise, Hammer, Sparkle, Tag } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { comboOf } from "@/lib/pricing";
import { PdpInfo } from "@/components/PdpInfo";
import { ZoomImage } from "@/components/ZoomImage";
import { Lightbox } from "@/components/Lightbox";
import { VariantPicker } from "@/components/VariantPicker";
import { Stars } from "@/components/Stars";
import type { ProductDetail as Product } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

// Aplazo installment anchor (approx). One place to tune.
const APLAZO_PAYMENTS = 6;

const VALUE_PROPS = [
  { icon: Truck, label: "Envío gratis" },
  { icon: ArrowsClockwise, label: "Primer cambio sin costo" },
  { icon: ShieldCheck, label: "Garantía 6 meses" },
  { icon: Hammer, label: "Hecho a mano" },
] as const;

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

  // headline price follows the chosen colour (variant override, else base)
  const colorPriceCents = useMemo(
    () => product.variants.find((v) => v.color === color && v.price_cents != null)?.price_cents ?? product.base_price_cents,
    [product.variants, product.base_price_cents, color],
  );

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      <div className="grid grid-cols-2 gap-3 self-start">
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
        <p className="nums mt-3 text-2xl font-medium">{mxn(colorPriceCents)}</p>
        <p className="mt-1 text-xs text-muted">
          Precio con IVA incluido · o {APLAZO_PAYMENTS} pagos de{" "}
          <span className="font-medium text-text">{mxn(Math.round(colorPriceCents / APLAZO_PAYMENTS))}</span> con Aplazo
        </p>

        {/* value props (trust row) */}
        <ul className="mt-4 grid grid-cols-2 gap-2">
          {VALUE_PROPS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 rounded-lg border border-border bg-elevated/60 px-2.5 py-2 text-xs">
              <Icon size={15} weight="bold" className="shrink-0 text-accent" />
              {label}
            </li>
          ))}
        </ul>

        {combo && (
          <div className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft/60 p-4">
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
              <Tag size={16} weight="fill" className="text-accent" />
              Combo {combo.minQty} pares — <span className="text-accent">{mxn(combo.priceCents)}</span>
            </p>
            <p className="mt-1.5 text-sm text-muted">
              Combina {combo.minQty} pares del combo — este u otro modelo, cualquier color. El descuento se aplica
              solo al agregar {combo.minQty} al carrito.
            </p>
            <Link href="/products" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
              Ver modelos del combo →
            </Link>
          </div>
        )}
        {product.description && (
          <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted">{product.description}</p>
        )}

        {product.made_to_order && (
          <div className="mt-6 space-y-2 rounded-xl border border-accent/25 bg-accent-soft/60 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkle size={18} weight="fill" className="text-accent" />
              Hecho solo para ti · edición limitada
            </p>
            <p className="flex items-start gap-2 text-sm text-muted">
              <Package size={17} className="mt-0.5 shrink-0" />
              No producimos de más: tu par se fabrica a mano al ordenarlo. Piel genuina, listo en 4-7 días hábiles con envío gratis.
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

        <PdpInfo />
      </div>
    </div>
  );
}
