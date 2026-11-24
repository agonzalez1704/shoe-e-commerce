"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Star } from "@phosphor-icons/react";
import { Etiqueta } from "@/components/pdp/GaleriaPdp";
import { formatCents } from "@/lib/money";
import { ProductImage } from "@/components/ProductImage";
import { swatchBg } from "@/lib/colors";
import { comboOf, comboLabel, precioConPromo } from "@/lib/pricing";
import type { ProductCard } from "@/lib/catalog";
import { CardTallas } from "@/components/CardTallas";
import { Favorito } from "@/components/Favorito";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const redondo = (c: number) => mxn(c).replace(/\.00$/, "");

const PILL = "rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide shadow-[var(--shadow-sm)]";
const PILL_DARK = `${PILL} bg-text uppercase text-bg`;

// One card = one variant colour (limited inventory). Links to the product with
// that colour preselected.
export function ProductCardItem({ p, priority, badge, tallaGuardada }: { p: ProductCard; priority?: boolean; badge?: string; tallaGuardada?: string | null }) {
  const href = p.color ? `/products/${p.slug}?color=${encodeURIComponent(p.color)}` : `/products/${p.slug}`;
  // unique per colourway so view-transition names don't collide on the grid
  const vtName = p.key.replace(/[^a-zA-Z0-9_-]/g, "-");
  const combo = comboOf(p.comboMinQty, p.comboPriceCents, p.comboMixtoCents, p.comboExoticoCents);
  const salePrice = precioConPromo(p.base_price_cents, p.promoPercent);
  const onSale = p.promoPercent != null && salePrice < p.base_price_cents;
  const etiqueta = p.masVendido ? "Más vendido" : badge;

  return (
    <li className="group">
      <Link href={href} className="block">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-elevated ring-1 ring-border/70 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-md)] group-hover:ring-accent/30">
          {p.image && (
            <ProductImage
              src={p.image}
              alt={`${p.name}${p.color ? ` ${p.color}` : ""}`}
              slug={vtName}
              width={500}
              height={500}
              priority={priority}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.05]"
            />
          )}
          {p.imageAlt && (
            <Image
              src={p.imageAlt}
              alt=""
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          )}

          {/* Two stacked columns rather than free-floating pills. The combo and
              discount badges were both pinned to left-2.5 top-2.5 and drew on
              top of each other on any product that had both. Stacking means a
              card can carry all three without collision. */}
          {/* Rediseño 2026-11: una sola etiqueta arriba ("Más vendido" real,
              si no la que mande la reja) y el combo abajo. El descuento ya no
              va sobre la foto: se dice en pesos junto al precio. */}
          {etiqueta && <Etiqueta texto={etiqueta} className="left-2 top-2 text-[11px]" />}
          {combo && (
            <span className={`pointer-events-none absolute bottom-2.5 left-2.5 ${PILL_DARK}`}>{comboLabel(combo, mxn, p.exotico)}</span>
          )}

          <Favorito slug={p.slug} color={p.color} />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3 opacity-0 transition-all duration-300 group-hover:opacity-100">
            <span className="flex items-center gap-1 rounded-full bg-text px-3 py-1.5 text-[11px] font-medium text-bg shadow-[var(--shadow-md)]">
              Ver producto <ArrowRight size={12} weight="bold" />
            </span>
          </div>
        </div>

        {/* lectura de arriba abajo: reseñas, nombre, color, precio con su ahorro */}
        <div className="mt-3 min-w-0">
          {p.rating && p.rating.count > 0 && (
            <p className="nums flex items-center gap-1 text-xs text-muted">
              <Star size={12} weight="fill" className="text-accent" />
              <strong className="font-semibold text-text">{p.rating.average.toFixed(1)}</strong>
              ({p.rating.count})
            </p>
          )}
          {p.brand && <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted">{p.brand}</p>}
          <p className="mt-0.5 truncate text-base font-semibold leading-tight transition-colors group-hover:text-accent">{p.name}</p>
          {p.color && (
            <span className="mt-1 flex items-center gap-1.5">
              <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-border" style={{ background: swatchBg(p.color) }} />
              <span className="truncate text-xs capitalize text-muted">{p.color}</span>
            </span>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className={`nums text-[17px] font-bold tabular-nums ${onSale ? "text-accent" : ""}`}>{redondo(onSale ? salePrice : p.base_price_cents)}</span>
            {onSale && (
              <>
                <span className="nums text-xs tabular-nums text-muted line-through">{redondo(p.base_price_cents)}</span>
                <span className="nums rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent">
                  Ahorras {redondo(p.base_price_cents - salePrice)}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>

      {p.tallas.length > 0 && (
        <CardTallas
          tallas={p.tallas}
          slug={p.slug}
          color={p.color}
          precioCents={onSale ? salePrice : p.base_price_cents}
          tallaGuardada={tallaGuardada}
        />
      )}
    </li>
  );
}
