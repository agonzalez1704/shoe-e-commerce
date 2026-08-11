import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { UserCircle } from "@phosphor-icons/react/dist/ssr";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { CartBadge } from "@/components/CartBadge";
import { MetaPixel } from "@/components/MetaPixel";
import { AnalyticsBeacon } from "@/components/AnalyticsBeacon";
import { ViewTransition } from "@/components/ViewTransition";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StorefrontOnly } from "@/components/StorefrontOnly";
import { Logo } from "@/components/Logo";
import { SiteHeader } from "@/components/SiteHeader";
import { listCategories } from "@/lib/catalog";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import { activeBrand, brandThemeCss } from "@/lib/brand";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["400", "500", "600", "700"] });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["400", "500"] });

const SEO_TITLE = activeBrand.seoSuffix ? `${SITE_NAME} — ${activeBrand.seoSuffix}` : SITE_NAME;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SEO_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SEO_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
};

// Brand knowledge-panel + sitelinks search box signals
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  areaServed: "MX",
  currenciesAccepted: "MXN",
  paymentAccepted: activeBrand.copy?.paymentNote,
};
const siteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/products?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

// set theme before paint to avoid a flash of the wrong mode
const themeScript = `(function(){try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Header and footer share one fetch per request (listCategories is cache()d).
  // A store with no categories yet — Blade today — gets neither the menu nor the
  // footer column, rather than three links to pages that do not exist.
  const categories = await listCategories();
  return (
    <html lang="es-MX" className={`${outfit.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        {/* Optional: only powers Facebook's domain insights attribution — link
            previews render fine without it, it's just what the Sharing Debugger
            nags about. Set NEXT_PUBLIC_FB_APP_ID to emit it. Needs `property`,
            which Next's metadata `other` can't produce, hence the raw tag. */}
        {process.env.NEXT_PUBLIC_FB_APP_ID && (
          <meta property="fb:app_id" content={process.env.NEXT_PUBLIC_FB_APP_ID} />
        )}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* per-brand theme tokens override globals.css defaults */}
        <style dangerouslySetInnerHTML={{ __html: brandThemeCss() }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
      </head>
      <body className="overflow-x-hidden">
        <NuqsAdapter>
          <MetaPixel />
          <AnalyticsBeacon />
          <StorefrontOnly>
          <Link href="/products" className="block bg-text text-bg transition-opacity hover:opacity-90">
            <p className="mx-auto max-w-6xl px-4 py-2 text-center text-xs font-medium">
              {activeBrand.announcement ?? "Envíos a todo México"}
            </p>
          </Link>
          <SiteHeader
            categories={categories}
            logo={
              <Link href="/" aria-label={SITE_NAME}>
                <Logo />
              </Link>
            }
            actions={
              <>
                <ThemeToggle />
                <Link
                  href="/cuenta"
                  aria-label="Cuenta"
                  className="grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:text-text"
                >
                  <UserCircle size={20} weight="regular" />
                </Link>
                <Link
                  href="/cart"
                  aria-label="Carrito"
                  className="relative grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:text-text"
                >
                  <CartBadge />
                </Link>
              </>
            }
          />
          </StorefrontOnly>

          <ViewTransition>
            <main className="mx-auto max-w-6xl px-4">{children}</main>
          </ViewTransition>

          <StorefrontOnly>
          <footer className="mt-24 border-t border-border">
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="text-muted">
                <p className="font-medium text-text">{SITE_NAME}</p>
                <p className="mt-2">{SITE_DESCRIPTION}</p>
                {activeBrand.copy?.paymentNote && <p className="mt-4 text-xs">{activeBrand.copy.paymentNote}</p>}
              </div>
              {categories.length > 0 && (
                <nav className="flex flex-col gap-2">
                  <p className="font-medium text-text">Categorías</p>
                  {categories.map((c) => (
                    <Link key={c.slug} href={`/categoria/${c.slug}`} className="text-muted transition-colors hover:text-text">
                      {c.name}
                    </Link>
                  ))}
                </nav>
              )}
              <nav className="flex flex-col gap-2">
                <p className="font-medium text-text">Tienda</p>
                <Link href="/products" className="text-muted transition-colors hover:text-text">Toda la tienda</Link>
                <Link href="/products?gender=mens" className="text-muted transition-colors hover:text-text">Hombre</Link>
                <Link href="/products?gender=womens" className="text-muted transition-colors hover:text-text">Mujer</Link>
                <Link href="/rastrear" className="text-muted transition-colors hover:text-text">Rastrear pedido</Link>
              </nav>
              <nav className="flex flex-col gap-2">
                <p className="font-medium text-text">Legal</p>
                <Link href="/envios" className="text-muted transition-colors hover:text-text">Envíos</Link>
                <Link href="/devoluciones" className="text-muted transition-colors hover:text-text">Devoluciones y cambios</Link>
                <Link href="/terminos" className="text-muted transition-colors hover:text-text">Términos y condiciones</Link>
                <Link href="/privacidad" className="text-muted transition-colors hover:text-text">Aviso de privacidad</Link>
              </nav>
            </div>
          </footer>
          </StorefrontOnly>
        </NuqsAdapter>
      </body>
    </html>
  );
}
