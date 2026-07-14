import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getProduct } from "@/lib/catalog";
import { getProductReviews } from "@/lib/reviews";
import { ProductDetail } from "@/components/ProductDetail";
import { ProductReviews } from "@/components/ProductReviews";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Producto no encontrado" };

  const desc =
    product.description?.slice(0, 155) ??
    `${product.name}${product.brand ? ` de ${product.brand}` : ""}. Calzado hecho sobre pedido, envío a todo México.`;
  const url = `${SITE_URL}/products/${slug}`;
  const cover = product.images[0]?.url;

  return {
    title: product.name,
    description: desc,
    alternates: { canonical: `/products/${slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} · ${SITE_NAME}`,
      description: desc,
      url,
      images: cover ? [{ url: cover, width: 800, height: 800, alt: product.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title: product.name, description: desc, images: cover ? [cover] : undefined },
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

  const reviews = await getProductReviews(product.id);

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
      <ProductReviews summary={reviews} />
    </div>
  );
}
