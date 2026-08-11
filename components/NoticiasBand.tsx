import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { fechaNoticia, type Noticia } from "@/lib/noticias";

// "Noticias y Eventos". Devuelve null sin notas — misma disciplina que
// Editorial() y BestSellers(): una tienda sin contenido no muestra un encabezado
// sobre un hueco.
export function NoticiasBand({ noticias }: { noticias: Noticia[] }) {
  if (!noticias.length) return null;
  return (
    <section className="border-t border-border py-14 sm:py-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold uppercase tracking-tight sm:text-4xl md:text-5xl">
            Noticias y eventos
          </h2>
          <p className="mt-2 text-sm text-muted">Lo que estamos haciendo y a dónde vamos.</p>
        </div>
        <Link href="/noticias" className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent">
          Ver todo
          <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Móvil: tira con scroll-snap y un asomo de la siguiente tarjeta. Tres
          tarjetas apiladas a ancho completo son tres pantallas de scroll para
          una sección a la que nadie entró buscando. */}
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {noticias.slice(0, 3).map((n) => (
          <li key={n.slug} className="w-[80%] shrink-0 snap-start md:w-auto">
            <NoticiaCard n={n} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NoticiaCard({ n }: { n: Noticia }) {
  return (
    <Link href={`/noticias/${n.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-elevated ring-1 ring-border/60">
        {n.cover_url ? (
          <Image
            src={n.cover_url}
            alt=""
            fill
            sizes="(max-width: 768px) 80vw, 33vw"
            className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-105"
          />
        ) : null}
        {n.categoria && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-contrast">
            {n.categoria}
          </span>
        )}
      </div>
      <p className="nums mt-3 text-xs text-muted">{fechaNoticia(n.published_at)}</p>
      <h3 className="mt-1 text-base font-semibold leading-snug tracking-tight">{n.titulo}</h3>
      <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-accent">
        Conoce más
        <ArrowRight size={13} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
