"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCents } from "@/lib/money";
import { ProductImage } from "@/components/ProductImage";
import { swatchBg } from "@/lib/colors";
import type { ProductCard } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export function ProductCardItem({ p, priority }: { p: ProductCard; priority?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const img = (active && p.colorImages[active]) || p.image;
  const multi = p.colors.length > 1;

  return (
    <li onMouseLeave={() => setActive(null)}>
      <Link href={`/products/${p.slug}`} className="group block">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-elevated transition-colors group-hover:border-accent/40">
          {img && (
            <ProductImage
              src={img}
              alt={p.name}
              slug={p.slug}
              width={400}
              height={400}
              priority={priority}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          )}
          {multi && (
            <span className="absolute left-2 top-2 rounded-full bg-bg/85 px-2 py-0.5 text-[10px] font-medium text-text backdrop-blur">
              {p.colors.length} colores
            </span>
          )}
        </div>
        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {p.brand && <p className="text-xs uppercase tracking-wide text-muted">{p.brand}</p>}
            <p className="truncate text-sm font-medium">{p.name}</p>
          </div>
          <p className="nums shrink-0 text-sm font-medium">{mxn(p.base_price_cents)}</p>
        </div>
      </Link>

      {multi && (
        <div className="mt-2 flex items-center gap-1.5">
          {p.colors.map((c) => (
            <Link
              key={c}
              href={`/products/${p.slug}`}
              aria-label={c}
              title={c}
              onMouseEnter={() => setActive(c)}
              className={`h-4 w-4 rounded-full border transition-transform hover:scale-110 ${
                active === c ? "border-text ring-1 ring-text/30" : "border-border"
              }`}
              style={{ background: swatchBg(c) }}
            />
          ))}
        </div>
      )}
    </li>
  );
}
