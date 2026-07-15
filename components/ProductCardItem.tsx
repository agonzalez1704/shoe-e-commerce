"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { ProductImage } from "@/components/ProductImage";
import { swatchBg } from "@/lib/colors";
import { comboOf, comboLabel } from "@/lib/pricing";
import type { ProductCard } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

// One card = one variant colour (limited inventory). Links to the product with
// that colour preselected.
export function ProductCardItem({ p, priority }: { p: ProductCard; priority?: boolean }) {
  const href = p.color ? `/products/${p.slug}?color=${encodeURIComponent(p.color)}` : `/products/${p.slug}`;
  // unique per colourway so view-transition names don't collide on the grid
  const vtName = p.key.replace(/[^a-zA-Z0-9_-]/g, "-");
  const combo = comboOf(p.comboMinQty, p.comboPriceCents);

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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageAlt}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          )}

          {combo && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold tracking-wide text-accent-contrast shadow-[var(--shadow-sm)]">
              {comboLabel(combo, mxn)}
            </span>
          )}

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
          <p className="nums shrink-0 text-[15px] font-semibold tabular-nums">{mxn(p.base_price_cents)}</p>
        </div>
      </Link>
    </li>
  );
}
