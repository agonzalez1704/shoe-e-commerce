import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { HomeFeature } from "@/lib/brand";

// The diptych-with-macro-inset band: a full-bleed shot, an inset detail crop,
// a claim and three bullets. It was inline in the homepage; the product page
// reuses it per category, so one asset set covers all 40 scooters instead of a
// bespoke block per model.
export function EditorialFeature({ f }: { f: HomeFeature }) {
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
