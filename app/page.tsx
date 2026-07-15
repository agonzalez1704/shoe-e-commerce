import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Package,
  Truck,
  CreditCard,
  MapPin,
  Tag,
  PencilSimpleLine,
  Hammer,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { listProducts, type ProductCard } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductGrid";
import { comboOf, comboLabel } from "@/lib/pricing";
import { formatCents } from "@/lib/money";

export const revalidate = 60;

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export default async function Home() {
  const products = await listProducts({ sort: "newest" });
  const featured = products.slice(0, 6);

  // one representative card per model that offers a 2x combo
  const combos: ProductCard[] = [];
  for (const p of products) {
    if (comboOf(p.comboMinQty, p.comboPriceCents) && !combos.some((c) => c.slug === p.slug)) combos.push(p);
  }
  const comboPicks = combos.slice(0, 2);

  return (
    <div className="reveal">
      <Hero />
      <Benefits />
      {comboPicks.length > 0 && <ComboBand picks={comboPicks} />}
      <Featured products={featured} total={products.length} />
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
          src="/hero-sneakers.jpg"
          alt="Sneakers de piel Blade en un patio mediterráneo al atardecer"
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
            <Image
              src="/blade-logo.png"
              alt="Blade"
              width={565}
              height={220}
              priority
              className="h-10 w-auto self-start object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] sm:h-12"
            />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
              Hecho sobre pedido
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-tight text-white drop-shadow-sm sm:text-6xl md:text-7xl">
              Piel con filo,
              <br />
              hecha a tu paso.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-lg">
              Sneakers de piel fabricados a mano cuando los pides. Tallas MX 25–30, envío gratis
              en 4–7 días hábiles a todo México.
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
  const items = [
    { icon: Package, title: "Hecho sobre pedido", sub: "Fabricado a mano para ti" },
    { icon: Truck, title: "Envío gratis", sub: "Entrega en 4–7 días hábiles" },
    { icon: CreditCard, title: "Paga como quieras", sub: "Tarjeta, OXXO, SPEI o Aplazo" },
    { icon: MapPin, title: "Todo México", sub: "Con factura disponible" },
  ];
  return (
    <section className="border-b border-border">
      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        {items.map(({ icon: Icon, title, sub }) => (
          <div key={title} className="flex items-start gap-3 bg-bg px-4 py-6 sm:px-6">
            <Icon size={22} weight="bold" className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs text-muted">{sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- combo band ---------------- */
function ComboBand({ picks }: { picks: ProductCard[] }) {
  const combo = comboOf(picks[0].comboMinQty, picks[0].comboPriceCents);
  return (
    <section className="py-14 sm:py-20">
      <div className="overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent-soft via-bg to-bg">
        <div className="grid items-center gap-8 p-7 sm:p-10 md:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-contrast">
              <Tag size={13} weight="fill" /> Combo
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Llévate 2 pares
              {combo && <> por <span className="text-accent">{mxn(combo.priceCents)}</span></>}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              Arma tu combo con cualquier color del mismo modelo y ahorra. Disponible en Londres y
              Manhattan — el descuento se aplica solo al agregar 2 al carrito.
            </p>
            <Link
              href={`/products/${picks[0].slug}`}
              className="group mt-6 inline-flex items-center gap-2 rounded-full bg-text px-6 py-3 text-sm font-semibold text-bg transition-transform active:scale-[0.98]"
            >
              Armar mi combo
              <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="flex gap-4">
            {picks.map((p) => {
              const c = comboOf(p.comboMinQty, p.comboPriceCents);
              return (
                <Link
                  key={p.key}
                  href={`/products/${p.slug}`}
                  className="group relative flex-1 overflow-hidden rounded-2xl bg-elevated ring-1 ring-border/60 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-md)]"
                >
                  <div className="relative aspect-square">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    )}
                    {c && (
                      <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-contrast">
                        {comboLabel(c, mxn)}
                      </span>
                    )}
                  </div>
                  <p className="truncate px-3 py-2.5 text-sm font-medium">{p.name}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- featured grid ---------------- */
function Featured({ products, total }: { products: ProductCard[]; total: number }) {
  return (
    <section className="border-t border-border py-14 sm:py-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Lo nuevo</h2>
          <p className="mt-1 text-sm text-muted">{total} productos · hechos sobre pedido</p>
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

/* ---------------- how it works ---------------- */
function HowItWorks() {
  const steps = [
    { icon: PencilSimpleLine, title: "Eliges tu par", sub: "Modelo, color y talla MX 25–30." },
    { icon: Hammer, title: "Lo fabricamos a mano", sub: "Cada par se hace especialmente para ti." },
    { icon: Sparkle, title: "Llega en 4–7 días", sub: "Envío gratis a todo México, con factura." },
  ];
  return (
    <section className="border-t border-border py-14 sm:py-20">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cómo funciona</h2>
      <p className="mt-1 text-sm text-muted">Sin inventario muerto. Piel de verdad, hecha a pedido.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, sub }, i) => (
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
        ))}
      </div>
    </section>
  );
}

/* ---------------- final CTA ---------------- */
function FinalCta() {
  return (
    <section className="pb-16">
      <div className="flex flex-col items-center gap-5 rounded-3xl bg-text px-6 py-14 text-center text-bg">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Tu próximo par te está esperando.
        </h2>
        <p className="max-w-md text-sm text-bg/70">
          Piel, filo y comodidad — hechos a tu medida. Envío gratis a todo México.
        </p>
        <Link
          href="/products"
          className="group inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98]"
        >
          Ver toda la tienda
          <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
