import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getCategory, listProductsByCategory } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductGrid";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Categoría no encontrada" };
  const desc = category.description?.slice(0, 155) ?? `Calzado de la categoría ${category.name}. Envío a todo México.`;
  return {
    title: category.name,
    description: desc,
    alternates: { canonical: `/categoria/${slug}` },
    openGraph: { type: "website", title: `${category.name} · ${SITE_NAME}`, description: desc, url: `${SITE_URL}/categoria/${slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, products] = await Promise.all([getCategory(slug), listProductsByCategory(slug)]);
  if (!category) notFound();

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
        <ProductGrid products={products} />
      )}
    </div>
  );
}
