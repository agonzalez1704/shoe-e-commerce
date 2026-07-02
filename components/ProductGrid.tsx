import Link from "next/link";
import { formatCents } from "@/lib/money";
import { ProductImage } from "@/components/ProductImage";
import type { ProductCard } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export function ProductGrid({ products }: { products: ProductCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <Link href={`/products/${p.slug}`} className="group block">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-elevated transition-colors group-hover:border-accent/40">
              {p.image && (
                <ProductImage
                  src={p.image}
                  alt={p.name}
                  slug={p.slug}
                  width={400}
                  height={400}
                  priority={i < 4}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
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
        </li>
      ))}
    </ul>
  );
}
