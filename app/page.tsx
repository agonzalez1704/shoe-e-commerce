import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

export default function Home() {
  return (
    <section className="reveal grid items-center gap-10 py-12 md:grid-cols-2 md:gap-16 md:py-20">
      <div>
        <p className="text-sm font-medium text-accent">Nueva temporada</p>
        <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Calzado para
          <br />
          cada paso.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
          Modelos seleccionados, todas las tallas y anchos. Envíos a todo México con pago en tarjeta, OXXO o SPEI.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/products"
            className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast transition-transform active:scale-[0.98]"
          >
            Ver tienda
            <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/products?gender=mens"
            className="rounded-full border border-border px-6 py-3 text-sm font-medium text-text transition-colors hover:bg-elevated"
          >
            Hombre
          </Link>
        </div>
      </div>

      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-elevated shadow-[var(--shadow-md)]">
        <Image
          src="https://picsum.photos/seed/soleco-hero-sneaker/900/1125"
          alt="Calzado destacado de la temporada"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}
