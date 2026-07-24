import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { UserCircle } from "@phosphor-icons/react/dist/ssr";
import { CartBadge } from "@/components/CartBadge";
import { MetaPixel } from "@/components/MetaPixel";
import { AnalyticsBeacon } from "@/components/AnalyticsBeacon";
import { ViewTransition } from "@/components/ViewTransition";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import { activeBrand, brandThemeCss } from "@/lib/brand";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["400", "500", "600", "700"] });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["400", "500"] });

const SEO_TITLE = `${SITE_NAME} — ${activeBrand.seoSuffix ?? "calzado hecho en México"}`;

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
  paymentAccepted: "Tarjeta, efectivo, SPEI",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${outfit.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* per-brand theme tokens override globals.css defaults */}
        <style dangerouslySetInnerHTML={{ __html: brandThemeCss() }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
      </head>
      <body className="overflow-x-hidden">
        <MetaPixel />
        <AnalyticsBeacon />
        <div className="bg-text text-bg">
          <p className="mx-auto max-w-6xl px-4 py-2 text-center text-xs">
            {activeBrand.announcement ?? "Envíos a todo México"}
          </p>
        </div>
        <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
          <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link href="/" aria-label={SITE_NAME}>
              <Logo />
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href="/products"
                className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-text"
              >
                Tienda
              </Link>
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
            </div>
          </nav>
        </header>

        <ViewTransition>
          <main className="mx-auto max-w-6xl px-4">{children}</main>
        </ViewTransition>

        <footer className="mt-24 border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-muted">
              <p className="font-medium text-text">{SITE_NAME}</p>
              <p className="mt-2">{SITE_DESCRIPTION}</p>
              <p className="mt-4 text-xs">Pagos con tarjeta, efectivo y SPEI. Facturación disponible.</p>
            </div>
            <nav className="flex flex-col gap-2">
              <p className="font-medium text-text">Categorías</p>
              <Link href="/categoria/running" className="text-muted transition-colors hover:text-text">Running</Link>
              <Link href="/categoria/casual" className="text-muted transition-colors hover:text-text">Casual</Link>
              <Link href="/categoria/trail" className="text-muted transition-colors hover:text-text">Trail</Link>
            </nav>
            <nav className="flex flex-col gap-2">
              <p className="font-medium text-text">Tienda</p>
              <Link href="/products" className="text-muted transition-colors hover:text-text">Todo el calzado</Link>
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
      </body>
    </html>
  );
}
