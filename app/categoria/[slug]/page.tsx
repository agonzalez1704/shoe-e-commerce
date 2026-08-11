import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getCategory, listProductsByCategory } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductGrid";
import { Pagination, paginar } from "@/components/Pagination";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { activeBrand } from "@/lib/brand";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Categoría no encontrada" };
  const desc =
    category.description?.slice(0, 155) ??
    `${category.name} en ${activeBrand.name}.${activeBrand.copy?.seoLine ? ` ${activeBrand.copy.seoLine}` : ""}`;
  return {
    title: category.name,
    description: desc,
    alternates: { canonical: `/categoria/${slug}` },
    openGraph: { type: "website", title: `${category.name} · ${SITE_NAME}`, description: desc, url: `${SITE_URL}/categoria/${slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { slug } = await params;
  const [category, products, sp] = await Promise.all([
    getCategory(slug),
    listProductsByCategory(slug),
    searchParams,
  ]);
  if (!category) notFound();

  // Se corta después de mapear a tarjetas y no en SQL: una tarjeta es una
  // combinación producto+color, así que un `range` en la consulta daría páginas
  // de tamaño desigual. Con 130 productos la consulta es barata; si el catálogo
  // creciera un orden de magnitud, ahí sí valdría paginar en la base.
  const { pagina, items } = paginar(products, Number(sp.p));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description: category.description ?? undefined,
    url: `${SITE_URL}/categoria/${slug}`,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Tienda", item: `${SITE_URL}/products` },
      { "@type": "ListItem", position: 2, name: category.name, item: `${SITE_URL}/categoria/${slug}` },
    ],
  };

  return (
    <div className="reveal py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <nav className="mb-6 flex items-center gap-1 text-xs text-muted">
        <Link href="/products" className="transition-colors hover:text-text">Tienda</Link>
        <CaretRight size={12} />
        <span className="text-text">{category.name}</span>
      </nav>

      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{category.name}</h1>
        {category.description && (
          <p className="mt-3 text-sm leading-relaxed text-muted">{category.description}</p>
        )}
        <p className="mt-2 text-sm text-muted">{products.length} modelos</p>
      </header>

      {products.length === 0 ? (
        <p className="text-muted">Aún no hay productos en esta categoría.</p>
      ) : (
        <>
          <ProductGrid products={items} />
          <Pagination pagina={pagina} total={products.length} base={`/categoria/${slug}`} />
        </>
      )}
    </div>
  );
}
