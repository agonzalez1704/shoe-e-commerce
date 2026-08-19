import type { Metadata } from "next";
import Link from "next/link";
import { listProducts, type ProductFilters } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductGrid";
import { PieCarrito } from "@/components/PieCarrito";
import { Pagination, paginar } from "@/components/Pagination";
import { ComboBand, comboPicks } from "@/components/ComboBand";
import { activeBrand } from "@/lib/brand";

export const revalidate = 60; // ISR — catalog changes infrequently

// Catalogue copy follows the brand: "calzado de piel hecho sobre pedido" was
// hardcoded here and shipped on a scooter store, in the page title and under
// the heading. Both now come from BrandConfig.
export const metadata: Metadata = {
  title: `Tienda — ${activeBrand.seoSuffix ?? activeBrand.tagline}`,
  description: activeBrand.description,
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
  const { pagina, items } = paginar(products, Number(sp.p));

  return (
    <div className="reveal py-8 sm:py-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tienda</h1>
          <p className="mt-1.5 text-sm text-muted">
            {products.length} {products.length === 1 ? "producto" : "productos"}
            {activeBrand.catalogNote ? ` · ${activeBrand.catalogNote}` : ""}
          </p>
        </div>
        <SortLinks current={filters.sort} />
      </div>

      {products.length === 0 ? (
        <p className="text-muted">No se encontraron productos.</p>
      ) : (
        <>
          <ComboBand picks={comboPicks(products)} />
          <PieCarrito />
      <ProductGrid products={items} />
          <Pagination
            pagina={pagina}
            total={products.length}
            base="/products"
            params={{ brand: sp.brand, gender: sp.gender, sort: sp.sort }}
          />
        </>
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
