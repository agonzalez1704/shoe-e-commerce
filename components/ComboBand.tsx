import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { comboOf, precioPar } from "@/lib/pricing";
import { formatCents } from "@/lib/money";
import type { ProductCard } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

// Cards del combo para ilustrar las tarifas: hasta 3 clasicos y 3 exoticos,
// modelos distintos. La banda las usa como fotos de "asi se ve cada tarifa".
export function comboPicks(products: ProductCard[]): ProductCard[] {
  const toma = (exotico: boolean, n: number) => {
    const out: ProductCard[] = [];
    for (const p of products) {
      if (p.exotico !== exotico || !comboOf(p.comboMinQty, p.comboPriceCents)) continue;
      if (!out.some((c) => c.slug === p.slug)) out.push(p);
      if (out.length === n) break;
    }
    return out;
  };
  return [...toma(false, 3), ...toma(true, 3)];
}

// Banda del combo: las tres tarifas con fotos y un solo boton al wizard. El
// precio de un par depende de la piel de los dos (0066), asi que la banda
// explica eso y nada mas.
export function ComboBand({ picks }: { picks: ProductCard[] }) {
  const base = picks.find((p) => comboOf(p.comboMinQty, p.comboPriceCents));
  const combo = base ? comboOf(base.comboMinQty, base.comboPriceCents, base.comboMixtoCents, base.comboExoticoCents) : null;
  if (!combo) return null;
  const cl = picks.filter((p) => !p.exotico);
  const ex = picks.filter((p) => p.exotico);
  const tarifas = [
    { nombre: "Clásico", desc: "Dos pares de piel lisa, brogue o perforada", precio: precioPar(combo, 0), fotos: [cl[0], cl[1]] },
    ...(combo.mixtoCents != null && ex.length ? [{ nombre: "Mixto", desc: "Un clásico y un exótico", precio: precioPar(combo, 1), fotos: [cl[2] ?? cl[0], ex[0]] }] : []),
    ...(combo.exoticoCents != null && ex.length > 1 ? [{ nombre: "Exótico", desc: "Dos pares con grabado exótico", precio: precioPar(combo, 2), fotos: [ex[1], ex[2] ?? ex[0]] }] : []),
  ].map((t) => ({ ...t, fotos: t.fotos.filter((f): f is ProductCard => !!f) }));
  const maxSuelto = Math.max(...picks.map((p) => p.base_price_cents));
  const ahorroMax = Math.max(0, 2 * maxSuelto - precioPar(combo, ex.length > 1 ? 2 : 0));

  return (
    <section className="py-10 sm:py-16">
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Combo de 2 pares</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Tú eliges la pareja</h2>
          </div>
          {ahorroMax > 0 && (
            <span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent">Ahorra hasta {mxn(ahorroMax)}</span>
          )}
        </div>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {tarifas.map((t) => (
            <Link key={t.nombre} href="/combo" className="flex items-center gap-3 rounded-2xl border border-border p-3 transition-colors hover:border-text sm:flex-col sm:items-center sm:text-center">
              <div className="flex shrink-0">
                {t.fotos.map((f, i) => (
                  <span key={f.key} className={`relative h-12 w-12 overflow-hidden rounded-xl border-2 border-surface bg-elevated sm:h-16 sm:w-16 ${i > 0 ? "-ml-3.5" : ""}`}>
                    {f.image && <Image src={f.image} alt={`${f.name} ${f.color ?? ""}`} fill sizes="64px" className="object-cover" />}
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.nombre}</p>
                <p className="text-xs text-muted">{t.desc}</p>
              </div>
              <p className="nums shrink-0 text-lg font-bold tracking-tight">{mxn(t.precio)}</p>
            </Link>
          ))}
        </div>

        <Link
          href="/combo"
          className="group mt-5 flex h-[50px] items-center justify-center gap-2 rounded-full bg-text text-[15px] font-semibold text-bg transition-transform active:scale-[0.99] sm:mx-auto sm:w-72"
        >
          Empezar a armar
          <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
        <p className="mt-3 text-center text-xs text-muted">Dos pasos: eliges un par, eliges el otro. Nada de sumar.</p>
      </div>
    </section>
  );
}
