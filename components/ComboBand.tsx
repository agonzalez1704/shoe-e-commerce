import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Tag } from "@phosphor-icons/react/dist/ssr";
import { comboOf, comboLabel } from "@/lib/pricing";
import { formatCents } from "@/lib/money";
import type { ProductCard } from "@/lib/catalog";
import { activeBrand } from "@/lib/brand";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
// "pares" only reads right in a shoe store; a combo is a generic promo.
const ITEMS = activeBrand.copy?.itemPlural ?? "productos";

// Up to n distinct combo-eligible models (one card per model).
export function comboPicks(products: ProductCard[], n = 2): ProductCard[] {
  const out: ProductCard[] = [];
  for (const p of products) {
    if (comboOf(p.comboMinQty, p.comboPriceCents) && !out.some((c) => c.slug === p.slug)) out.push(p);
  }
  return out.slice(0, n);
}

export function ComboBand({ picks }: { picks: ProductCard[] }) {
  if (!picks.length) return null;
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
              Llévate 2 {ITEMS}
              {combo && <> por <span className="text-accent">{mxn(combo.priceCents)}</span></>}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              Combina 2 {ITEMS} de los modelos del combo — mismo o distinto modelo, cualquier color.
              El descuento se aplica solo al agregar 2 al carrito.
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
                      <Image src={p.image} alt={p.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
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
