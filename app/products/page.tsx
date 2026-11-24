import type { Metadata } from "next";
import Link from "next/link";
import { listProducts, type ProductFilters } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductGrid";
import { PieCarrito } from "@/components/PieCarrito";
import { Pagination, paginar } from "@/components/Pagination";
import { ComboBand, comboPicks } from "@/components/ComboBand";
import { activeBrand } from "@/lib/brand";
import { Check } from "@phosphor-icons/react/dist/ssr";

const CHECKLIST = activeBrand.catalogChecklist ?? [];


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
    sort: (["newest", "price_asc", "price_desc", "top"] as const).find((s) => s === sp.sort) ?? "newest",
  };
  // ?combo=1: solo los colores que entran al combo (el combo ya no abarca todo el catalogo)
  const todos = await listProducts(filters);
  const soloCombo = sp.combo === "1";
  const products = soloCombo ? todos.filter((p) => p.comboMinQty != null) : todos;
  const { pagina, items } = paginar(products, Number(sp.p));
  // sin historial de ventas el orden "Más vendidos" seria "lo nuevo" con otro nombre
  const conVendidos = todos.some((p) => p.masVendido);

  return (
    <div className="reveal py-8 sm:py-10">
      <div className="mb-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{soloCombo ? "Modelos del combo" : "Tienda"}</h1>
              <span className="nums text-sm text-muted">
                {products.length} {products.length === 1 ? "producto" : "productos"}
              </span>
            </div>
            {/* lo que el cliente iba a buscar, dicho antes de la primera tarjeta */}
            {CHECKLIST.length > 0 ? (
              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
                {CHECKLIST.map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-text text-bg">
                      <Check size={9} weight="bold" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            ) : activeBrand.catalogNote ? (
              <p className="mt-1.5 text-sm text-muted">{activeBrand.catalogNote}</p>
            ) : null}
          </div>
          <SortLinks current={filters.sort} combo={soloCombo} conVendidos={conVendidos} />
        </div>
      </div>

      {products.length === 0 ? (
        <p className="text-muted">No se encontraron productos.</p>
      ) : (
        <>
          <ComboBand picks={comboPicks(products)} franja />
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

function SortLinks({ current, combo, conVendidos }: { current?: string; combo: boolean; conVendidos: boolean }) {
  const opts = [
    ["newest", "Nuevo"],
    ...(conVendidos ? [["top", "Más vendidos"] as const] : []),
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
