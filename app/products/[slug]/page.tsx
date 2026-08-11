import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getProduct, listRelatedProducts } from "@/lib/catalog";
import { activeBrand } from "@/lib/brand";
import { EditorialFeature } from "@/components/EditorialFeature";
import { getProductReviews } from "@/lib/reviews";
import { ProductDetail } from "@/components/ProductDetail";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductReviews } from "@/components/ProductReviews";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { ogCardUrl } from "@/lib/og-card";

export const revalidate = 60;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { color } = await searchParams;
  const product = await getProduct(slug);
  if (!product) return { title: "Producto no encontrado" };

  const desc =
    product.description?.slice(0, 155) ??
    `${product.name}${product.brand ? ` de ${product.brand}` : ""}.${activeBrand.copy?.seoLine ? ` ${activeBrand.copy.seoLine}` : ""}`;
  const url = `${SITE_URL}/products/${slug}`;

  // Pre-rendered 1200x630 JPEG share card. The product photos themselves are
  // portrait WebP (served from Storage), which link previews crop badly and
  // Meta/WhatsApp don't reliably decode — hence a dedicated card per colourway.
  // only a colourway that actually has photos got a card generated
  const hasCard = !!color && product.images.some((i) => i.color === color);
  const cover = ogCardUrl(slug, hasCard ? color : undefined);

  return {
    title: product.name,
    description: desc,
    alternates: { canonical: `/products/${slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} · ${SITE_NAME}`,
      description: desc,
      url,
      images: [{ url: cover, width: 1200, height: 630, type: "image/jpeg", alt: product.name }],
    },
    twitter: { card: "summary_large_image", title: product.name, description: desc, images: [cover] },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string }>;
}) {
  const { slug } = await params;
  const { color } = await searchParams;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [reviews, related] = await Promise.all([
    getProductReviews(product.id),
    listRelatedProducts(slug, 3),
  ]);

  const url = `${SITE_URL}/products/${slug}`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.images.map((i) => i.url),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    // star ratings in Google results
    ...(reviews.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.average.toFixed(1), reviewCount: reviews.count } }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "MXN",
      price: (product.base_price_cents / 100).toFixed(2),
      availability: "https://schema.org/InStock", // made-to-order: always orderable
      url,
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  // First matching category wins. A product in two categories would otherwise
  // stack both sets of bands and read as a page that repeats itself.
  const byCategory = activeBrand.pdp?.categoryFeatures ?? {};
  const categoryFeatures = product.categorySlugs.map((s) => byCategory[s]).find(Boolean) ?? [];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Tienda", item: `${SITE_URL}/products` },
      { "@type": "ListItem", position: 2, name: product.name, item: url },
    ],
  };

  return (
    <div className="py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <nav className="mb-6 flex items-center gap-1 text-xs text-muted">
        <Link href="/products" className="transition-colors hover:text-text">Tienda</Link>
        <CaretRight size={12} />
        <span className="text-text">{product.name}</span>
      </nav>

      <ProductDetail product={product} initialColor={color} rating={reviews.count ? { average: reviews.average, count: reviews.count } : undefined} />

      {/* Editorial bands for whichever category this product belongs to. Nothing
          renders until the brand supplies the art, so a store without it just
          ends at the buy box. */}
      {categoryFeatures.map((f, i) => (
        <EditorialFeature key={`${f.eyebrow}-${i}`} f={f} />
      ))}

      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Combínalo con</h2>
              {activeBrand.copy?.relatedNote && (
                <p className="mt-1 text-sm text-muted">{activeBrand.copy.relatedNote}</p>
              )}
            </div>
            <Link href="/products" className="text-sm font-medium text-accent hover:underline">Ver todo</Link>
          </div>
          <ProductGrid products={related} />
        </section>
      )}

      <ProductReviews summary={reviews} />
    </div>
  );
}
