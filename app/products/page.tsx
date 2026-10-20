import type { Metadata } from "next";
import Link from "next/link";
import { listProducts, type ProductFilters } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductGrid";
import { PieCarrito } from "@/components/PieCarrito";
import { Pagination, paginar } from "@/components/Pagination";
import { ComboBand, comboPicks } from "@/components/ComboBand";
import { activeBrand } from "@/lib/brand";


// Catalogue copy follows the brand: "calzado de piel hecho sobre pedido" was
// hardcoded here and shipped on a scooter store, in the page title and under
// the heading. Both now come from BrandConfig.
// Es la liga que se manda cuando piden "el catálogo": su vista previa en
// Messenger/WhatsApp necesita título, URL e imagen propios (heredaba los de inicio, sin imagen).
const CATALOGO = `Catálogo ${activeBrand.name}`;
export const metadata: Metadata = {
  title: `Tienda — ${activeBrand.seoSuffix ?? activeBrand.tagline}`,
  description: activeBrand.description,
  alternates: { canonical: "/products" },
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: activeBrand.name,
    url: "/products",
    title: CATALOGO,
    description: activeBrand.description,
    ...(activeBrand.ogImage ? { images: [{ url: activeBrand.ogImage, width: 1200, height: 630, alt: CATALOGO }] } : {}),
  },
  twitter: { card: "summary_large_image", title: CATALOGO, description: activeBrand.description, ...(activeBrand.ogImage ? { images: [activeBrand.ogImage] } : {}) },
};

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters: ProductFilters = {
    brand: sp.brand,
    gender: sp.gender,
    sort: (sp.sort as ProductFilters["sort"]) ?? "newest",
  };
  // ?combo=1: solo los colores que entran al combo (el combo ya no abarca todo el catalogo)
  const todos = await listProducts(filters);
  const soloCombo = sp.combo === "1";
  const products = soloCombo ? todos.filter((p) => p.comboMinQty != null) : todos;
  const { pagina, items } = paginar(products, Number(sp.p));

  return (
    <div className="reveal py-8 sm:py-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{soloCombo ? "Modelos del combo" : "Tienda"}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {products.length} {products.length === 1 ? "producto" : "productos"}
            {activeBrand.catalogNote ? ` · ${activeBrand.catalogNote}` : ""}
          </p>
        </div>
        <SortLinks current={filters.sort} combo={soloCombo} />
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
            params={{ brand: sp.brand, gender: sp.gender, sort: sp.sort, combo: sp.combo }}
          />
        </>
      )}
    </div>
  );
}

function SortLinks({ current, combo }: { current?: string; combo: boolean }) {
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
          href={`/products?sort=${val}${combo ? "&combo=1" : ""}`}
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
