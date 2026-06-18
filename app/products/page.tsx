import type { Metadata } from "next";
import Link from "next/link";
import { listProducts, type ProductFilters } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductGrid";

export const revalidate = 60; // ISR — catalog changes infrequently

export const metadata: Metadata = {
  title: "Tienda — calzado de piel",
  description: "Explora el catálogo de calzado de piel hecho sobre pedido. Todas las tallas y anchos, envío a todo México.",
  alternates: { canonical: "/products" },
};

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters: ProductFilters = {
    brand: sp.brand,
    gender: sp.gender,
    sort: (sp.sort as ProductFilters["sort"]) ?? "newest",
  };
  const products = await listProducts(filters);

  return (
    <div className="reveal py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tienda</h1>
          <p className="mt-1 text-sm text-muted">{products.length} modelos disponibles</p>
        </div>
        <SortLinks current={filters.sort} />
      </div>

      {products.length === 0 ? (
        <p className="text-muted">No se encontraron productos.</p>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}

function SortLinks({ current }: { current?: string }) {
  const opts = [
    ["newest", "Nuevo"],
    ["price_asc", "Precio ↑"],
    ["price_desc", "Precio ↓"],
  ] as const;
  return (
    <div className="flex gap-1 rounded-full border border-border p-1">
      {opts.map(([val, label]) => (
        <Link
          key={val}
          href={`/products?sort=${val}`}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            current === val ? "bg-text text-bg" : "text-muted hover:text-text"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
