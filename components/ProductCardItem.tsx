"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { ProductImage } from "@/components/ProductImage";
import { swatchBg } from "@/lib/colors";
import { comboOf, comboLabel, precioConPromo } from "@/lib/pricing";
import type { ProductCard } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

const PILL = "rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide shadow-[var(--shadow-sm)]";
const PILL_ACCENT = `${PILL} bg-accent text-accent-contrast`;
const PILL_DARK = `${PILL} bg-text uppercase text-bg`;

// One card = one variant colour (limited inventory). Links to the product with
// that colour preselected.
export function ProductCardItem({ p, priority, badge }: { p: ProductCard; priority?: boolean; badge?: string }) {
  const href = p.color ? `/products/${p.slug}?color=${encodeURIComponent(p.color)}` : `/products/${p.slug}`;
  // unique per colourway so view-transition names don't collide on the grid
  const vtName = p.key.replace(/[^a-zA-Z0-9_-]/g, "-");
  const combo = comboOf(p.comboMinQty, p.comboPriceCents);
  const salePrice = precioConPromo(p.base_price_cents, p.promoPercent);
  const onSale = p.promoPercent != null && salePrice < p.base_price_cents;

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
          <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
            {combo && <span className={PILL_ACCENT}>{comboLabel(combo, mxn)}</span>}
          </div>
          <div className="pointer-events-none absolute right-2.5 top-2.5 flex flex-col items-end gap-1.5">
            {onSale && <span className={PILL_ACCENT}>-{p.promoPercent}%</span>}
            {badge && <span className={PILL_DARK}>{badge}</span>}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3 opacity-0 transition-all duration-300 group-hover:opacity-100">
            <span className="flex items-center gap-1 rounded-full bg-text px-3 py-1.5 text-[11px] font-medium text-bg shadow-[var(--shadow-md)]">
              Ver producto <ArrowRight size={12} weight="bold" />
            </span>
          </div>
        </div>

        <div className="mt-3.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {p.brand && <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{p.brand}</p>}
            <p className="mt-0.5 truncate text-[15px] font-medium leading-tight transition-colors group-hover:text-accent">{p.name}</p>
            {p.color && (
              <span className="mt-1.5 flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-border" style={{ background: swatchBg(p.color) }} />
                <span className="truncate text-xs capitalize text-muted">{p.color}</span>
              </span>
            )}
          </div>
          {onSale ? (
            <div className="shrink-0 text-right">
              <p className="nums text-[15px] font-semibold tabular-nums text-accent">{mxn(salePrice)}</p>
              <p className="nums text-xs tabular-nums text-muted line-through">{mxn(p.base_price_cents)}</p>
            </div>
          ) : (
            <p className="nums shrink-0 text-[15px] font-semibold tabular-nums">{mxn(p.base_price_cents)}</p>
          )}
        </div>
      </Link>
    </li>
  );
}
