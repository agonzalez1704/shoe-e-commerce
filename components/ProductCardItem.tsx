"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { ProductImage } from "@/components/ProductImage";
import { swatchBg } from "@/lib/colors";
import type { ProductCard } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export function ProductCardItem({ p, priority }: { p: ProductCard; priority?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const primary = (active && p.colorImages[active]) || p.image;
  const alt = active ? null : p.imageAlt; // hover crossfade only on the default view
  const multi = p.colors.length > 1;

  return (
    <li onMouseLeave={() => setActive(null)} className="group">
      <Link href={`/products/${p.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-elevated ring-1 ring-border/70 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-md)] group-hover:ring-accent/30">
          {primary && (
            <ProductImage
              src={primary}
              alt={p.name}
              slug={p.slug}
              width={500}
              height={500}
              priority={priority}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.05]"
            />
          )}
          {alt && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={alt}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          )}

          {multi && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-bg/85 px-2 py-0.5 text-[10px] font-medium text-text backdrop-blur">
              {p.colors.length} colores
            </span>
          )}

          {/* hover reveal */}
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
          </div>
          <p className="nums shrink-0 text-[15px] font-semibold tabular-nums">{mxn(p.base_price_cents)}</p>
        </div>
      </Link>

      {multi && (
        <div className="mt-2.5 flex items-center gap-2">
          {p.colors.map((c) => (
            <Link
              key={c}
              href={`/products/${p.slug}`}
              aria-label={c}
              title={c}
              onMouseEnter={() => setActive(c)}
              className={`h-[18px] w-[18px] rounded-full ring-1 ring-inset transition-transform hover:scale-110 ${
                active === c ? "ring-2 ring-text" : "ring-border"
              }`}
              style={{ background: swatchBg(c) }}
            />
          ))}
        </div>
      )}
    </li>
  );
}
