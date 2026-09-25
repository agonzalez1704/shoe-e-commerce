import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Truck } from "@phosphor-icons/react/dist/ssr";
import { listProducts, type ProductCard } from "@/lib/catalog";
import { comboOf, precioPar } from "@/lib/pricing";
import { formatCents } from "@/lib/money";

export const metadata = {
  title: "Arma tu combo de 2 pares",
  description: "Elige dos pares, del mismo modelo o distinto. El precio depende de la piel que combines. Envío gratis a todo México.",
};

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

// Entrada al combo: las tres tarifas explicadas con fotos reales (la diferencia
// entre clasico y exotico se ve, no se lee) y un solo boton para empezar.
export default async function ComboEntrada() {
  const cards = (await listProducts()).filter((c) => c.comboMinQty != null && c.comboPriceCents != null);
  const primera = cards[0];
  const combo = primera ? comboOf(primera.comboMinQty, primera.comboPriceCents, primera.comboMixtoCents, primera.comboExoticoCents) : null;

  if (!combo) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Por ahora no hay combo activo</h1>
        <Link href="/products" className="mt-4 inline-block text-accent underline">Ver la tienda</Link>
      </div>
    );
  }

  const clasicos = cards.filter((c) => !c.exotico);
  const exoticos = cards.filter((c) => c.exotico);
  const par = (a: ProductCard | undefined, b: ProductCard | undefined) => [a, b].filter((x): x is ProductCard => !!x);
  const tarifas = [
    { nombre: "Clásico", desc: "Dos pares de piel lisa, brogue o perforada", precio: precioPar(combo, 0), fotos: par(clasicos[0], clasicos[1]) },
    ...(combo.mixtoCents != null && exoticos.length
      ? [{ nombre: "Mixto", desc: "Un clásico y un par con grabado exótico", precio: precioPar(combo, 1), fotos: par(clasicos[2] ?? clasicos[0], exoticos[0]) }]
      : []),
    ...(combo.exoticoCents != null && exoticos.length > 1
      ? [{ nombre: "Exótico", desc: "Dos pares con grabado cocodrilo, pitón, lizard o mantarraya", precio: precioPar(combo, 2), fotos: par(exoticos[1], exoticos[2] ?? exoticos[0]) }]
      : []),
  ];
  const maxSuelto = Math.max(...cards.map((c) => c.base_price_cents));
  const ahorroMax = Math.max(0, 2 * maxSuelto - precioPar(combo, exoticos.length > 1 ? 2 : 0));

  return (
    <div className="mx-auto max-w-md py-6 sm:py-10">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
        <Truck size={13} weight="fill" /> Envío gratis a todo México
      </p>
      <h1 className="mt-3 text-[34px] font-bold leading-[1.05] tracking-tight">Arma tu combo<br />de 2 pares</h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted">
        Elige dos, del mismo modelo o distinto. El precio depende de la piel que combines.
        {ahorroMax > 0 && <> Ahorras hasta <strong className="nums text-text">{mxn(ahorroMax)}</strong>.</>}
      </p>

      <div className="mt-5 space-y-2.5">
        {tarifas.map((t) => (
          <div key={t.nombre} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
            <div className="flex shrink-0">
              {t.fotos.map((f, i) => (
                <span key={f.key} className={`relative h-14 w-14 overflow-hidden rounded-xl border-2 border-surface bg-elevated ${i > 0 ? "-ml-4" : ""}`}>
                  {f.image && <Image src={f.image} alt={`${f.name} ${f.color ?? ""}`} fill sizes="56px" className="object-cover" />}
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{t.nombre}</p>
              <p className="text-xs text-muted">{t.desc}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="nums text-xl font-bold tracking-tight">{mxn(t.precio)}</p>
              <p className="text-[11px] text-muted">los 2 pares</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/combo/armar"
        className="mt-5 flex h-[54px] items-center justify-center gap-2 rounded-full bg-text text-base font-semibold text-bg transition-transform active:scale-[0.99]"
      >
        Empezar a armar <ArrowRight size={16} weight="bold" />
      </Link>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-muted">
        {[["Piel genuina", "hecha a mano en León"], ["4 a 7 días", "se fabrica para ti"], ["Cambio de talla", "sin costo"]].map(([t, s]) => (
          <div key={t} className="rounded-xl border border-border bg-surface px-1.5 py-2.5"><strong className="block text-text">{t}</strong>{s}</div>
        ))}
      </div>

      <p className="mt-5 text-center text-xs text-muted">
        ¿Solo quieres un par? <Link href="/products" className="font-medium text-text underline">Ver la tienda</Link>
      </p>
    </div>
  );
}
