import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Package,
  Truck,
  CreditCard,
  MapPin,
  PencilSimpleLine,
  Hammer,
  Sparkle,
  ShieldCheck,
  Lightning,
} from "@phosphor-icons/react/dist/ssr";
import { listProducts, listBestSellers, listFeatured, type ProductCard } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductGrid";
import { ComboBand, comboPicks } from "@/components/ComboBand";
import { activeBrand, type HomeFeature } from "@/lib/brand";
import { SITE_NAME } from "@/lib/site";

// Icon keys → components. BrandConfig can only carry the key (it is plain data
// shared with client files), and the server page resolves it from the `/ssr`
// entry point. An unknown key falls back rather than crashing the homepage.
const ICONS: Record<string, typeof Package> = {
  package: Package,
  truck: Truck,
  card: CreditCard,
  pin: MapPin,
  pencil: PencilSimpleLine,
  hammer: Hammer,
  sparkle: Sparkle,
  shield: ShieldCheck,
  lightning: Lightning,
};
const icon = (k: string) => ICONS[k] ?? Sparkle;

export const revalidate = 60;

// Storefront editorial comes from the brand config, so a second store fills it
// in instead of editing this file.
const home = activeBrand.home;
const hero = home?.hero ?? {
  image: "/hero-moto.jpg", eyebrow: "", titleTop: activeBrand.name,
  titleBottom: "", body: activeBrand.tagline,
};
const FEATURES: HomeFeature[] = home?.features ?? [];

export default async function Home() {
  const [products, bestSellers] = await Promise.all([
    listProducts({ sort: "newest" }),
    listBestSellers(8),
  ]);
  // sin historial de ventas, una repisa elegida a mano bajo otro título — nunca
  // lo más nuevo disfrazado de lo más vendido
  const curated = bestSellers.length === 0;
  const shelf = curated ? await listFeatured(8) : bestSellers;
  const featured = products.slice(0, 6);
  const combos = comboPicks(products);

  return (
    <div className="reveal">
      <Hero />
      <Benefits />
      <BestSellers products={shelf} curated={curated} />
      {combos.length > 0 && <ComboBand picks={combos} />}
      {FEATURES[0] && <EditorialFeature f={FEATURES[0]} />}
      <Featured products={featured} total={products.length} />
      {FEATURES[1] && <EditorialFeature f={FEATURES[1]} />}
      <Editorial />
      <HowItWorks />
      <FinalCta />
    </div>
  );
}

/* ---------------- hero (full-bleed) ---------------- */
function Hero() {
  return (
    <section className="relative ml-[calc(50%-50vw)] w-screen">
      <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/9]">
        <Image
          src={hero.image}
          alt={`${SITE_NAME} — ${hero.titleTop} ${hero.titleBottom}`}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* legibility scrim: darker toward the lower-left where the copy sits */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent" />

        <div className="absolute inset-0 flex items-end md:items-center">
          <div className="mx-auto flex w-full max-w-6xl flex-col px-5 pb-14 md:pb-0">
            {activeBrand.logo && (
              <Image
                src={activeBrand.logo.src}
                alt={activeBrand.logo.alt ?? SITE_NAME}
                width={activeBrand.logo.width}
                height={activeBrand.logo.height}
                priority
                className="h-10 w-auto self-start object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] sm:h-12"
              />
            )}
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
              {hero.eyebrow}
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-tight text-white drop-shadow-sm sm:text-6xl md:text-7xl">
              {hero.titleTop}
              <br />
              {hero.titleBottom}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-lg">
              {hero.body}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/products"
                className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-transform active:scale-[0.98]"
              >
                Ver tienda
                <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/products?sort=newest"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                Lo nuevo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- benefits strip ---------------- */
function Benefits() {
  const items = home?.benefits ?? [];
  if (!items.length) return null;
  // The count is per brand now, so a fixed 4-column grid would leave a
  // border-coloured hole on a store that lists three.
  const cols = items.length % 4 === 0 ? "md:grid-cols-4" : items.length % 3 === 0 ? "md:grid-cols-3" : "md:grid-cols-2";
  return (
    <section className="border-b border-border">
      <div className={`grid grid-cols-2 gap-px bg-border ${cols}`}>
        {items.map(({ icon: k, title, sub }) => {
          const Icon = icon(k);
          return (
          <div key={title} className="flex items-start gap-3 bg-bg px-4 py-6 sm:px-6">
            <Icon size={22} weight="bold" className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs text-muted">{sub}</p>
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- featured grid ---------------- */
// Real best sellers, ranked by units actually sold. Rendered only when there is
// enough history: a store with no orders yet gets nothing rather than its newest
// arrivals dressed up as favourites.
function BestSellers({ products, curated }: { products: ProductCard[]; curated: boolean }) {
  if (!products.length) return null;
  return (
    <section className="border-t border-border py-14 sm:py-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold uppercase tracking-tight sm:text-4xl md:text-5xl">
            {curated ? "Destacados" : "Los más vendidos"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {curated ? "Nuestra selección para empezar." : "Lo que más se está llevando la gente."}
          </p>
        </div>
        <Link href="/products" className="group inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          Ver todo
          <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <ProductGrid products={products} />
    </section>
  );
}

function Featured({ products, total }: { products: ProductCard[]; total: number }) {
  return (
    <section className="border-t border-border py-14 sm:py-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold uppercase tracking-tight sm:text-4xl md:text-5xl">Lo nuevo</h2>
          <p className="mt-2 text-sm text-muted">
            {total} productos{activeBrand.catalogNote ? ` · ${activeBrand.catalogNote}` : ""}
          </p>
        </div>
        <Link href="/products" className="group inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          Ver todo
          <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <ProductGrid products={products} newestCount={2} />
    </section>
  );
}

/* ---------------- editorial feature (diptych split, Nuvé-style) ---------------- */


function EditorialFeature({ f }: { f: HomeFeature }) {
  const media = (
    <div className="relative">
      <div className="absolute -inset-3 -z-10 rounded-3xl bg-accent-soft" aria-hidden />
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl ring-1 ring-border">
        <Image src={f.main} alt={f.alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
      </div>
      {/* framed macro-detail accent, overlapping the corner */}
      <div className={`absolute -bottom-6 w-28 overflow-hidden rounded-2xl shadow-[var(--shadow-md)] ring-4 ring-bg sm:w-36 ${f.flip ? "-left-4" : "-right-4"}`}>
        <div className="relative aspect-square w-full">
          <Image src={f.macro} alt="" fill sizes="144px" className="object-cover" />
        </div>
      </div>
    </div>
  );
  const copy = (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">{f.eyebrow}</p>
      <h2 className="mt-3 text-4xl font-semibold uppercase leading-[0.95] tracking-tight sm:text-5xl md:text-6xl">{f.titleTop}<br />{f.titleBottom}</h2>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">{f.body}</p>
      <ul className="mt-6 space-y-2.5">
        {f.points.map((t) => (
          <li key={t} className="flex items-center gap-3 text-sm">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {t}
          </li>
        ))}
      </ul>
      <Link
        href={f.ctaHref}
        className="group mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-transform active:scale-[0.98]"
      >
        {f.ctaLabel}
        <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
  return (
    <section className="py-14 sm:py-20">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
        {f.flip ? <>{copy}{media}</> : <>{media}{copy}</>}
      </div>
    </section>
  );
}


/* ---------------- editorial / lifestyle gallery ---------------- */
function Editorial() {
  const shots = home?.editorial ?? [];
  if (!shots.length) return null;   // a store without lifestyle shots just skips the band
  return (
    <section className="border-t border-border py-14 sm:py-20">
      <div className="mb-8 max-w-xl">
        <h2 className="text-3xl font-semibold uppercase tracking-tight sm:text-4xl md:text-5xl">{home?.editorialTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{home?.editorialBody}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {shots.map((s, i) => (
          <Link
            key={s.name}
            href={s.href}
            className={`group relative overflow-hidden rounded-2xl bg-elevated ring-1 ring-border/60 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-md)] ${
              i === 0 ? "col-span-2 md:col-span-1" : ""
            }`}
          >
            <div className={`relative ${i === 0 ? "aspect-[16/10] md:aspect-[4/5]" : "aspect-[4/5]"}`}>
              <Image
                src={s.img}
                alt={`${SITE_NAME} ${s.name} en uso`}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-105"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4">
              <span className="text-sm font-semibold text-white drop-shadow">{s.name}</span>
              <span className="flex items-center gap-1 text-xs font-medium text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                Ver <ArrowRight size={12} weight="bold" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------------- how it works ---------------- */
function HowItWorks() {
  const cfg = home?.howItWorks;
  if (!cfg?.steps.length) return null;
  return (
    <section className="border-t border-border py-14 sm:py-20">
      <h2 className="text-3xl font-semibold uppercase tracking-tight sm:text-4xl md:text-5xl">{cfg.title}</h2>
      <p className="mt-2 text-sm text-muted">{cfg.sub}</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {cfg.steps.map(({ icon: k, title, sub }, i) => {
          const Icon = icon(k);
          return (
          <div key={title} className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Icon size={20} weight="bold" />
              </span>
              <span className="nums text-sm font-semibold text-muted">0{i + 1}</span>
            </div>
            <p className="mt-4 font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{sub}</p>
          </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- final CTA ---------------- */
function FinalCta() {
  const cta = home?.finalCta;
  if (!cta) return null;
  return (
    <section className="pb-16">
      <div className="flex flex-col items-center gap-5 rounded-3xl bg-text px-6 py-14 text-center text-bg">
        <h2 className="max-w-2xl text-3xl font-semibold uppercase tracking-tight sm:text-5xl md:text-6xl">
          {cta.title}
        </h2>
        <p className="max-w-md text-sm text-bg/70">{cta.body}</p>
        <Link
          href={cta.ctaHref}
          className="group inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98]"
        >
          {cta.ctaLabel}
          <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
