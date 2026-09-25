"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Img = { url: string; alt?: string | null };

// Galeria de la ficha. En celular se desliza con el dedo (scroll-snap nativo,
// sin libreria): "Siguiente" era lo mas tocado de la ficha, asi que las fotos
// van a todo el ancho y se cambian sin apuntarle a una flecha. En escritorio,
// rejilla: la primera grande y el resto en dos columnas. Tocar = ampliar.
export function GaleriaPdp({
  images, name, onOpen, badge,
}: {
  images: Img[];
  name: string;
  onOpen: (i: number) => void;
  badge?: string | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiva(Number((e.target as HTMLElement).dataset.i));
      },
      { root: el, threshold: 0.6 },
    );
    for (const child of el.children) io.observe(child);
    return () => io.disconnect();
  }, [images.length]);

  if (!images.length) {
    return <div className="grid aspect-square place-items-center rounded-3xl bg-elevated text-sm text-muted">Sin foto por ahora</div>;
  }

  return (
    <>
      {/* celular: a sangre, se desliza */}
      <div className="relative -mx-4 md:hidden">
        <div
          ref={scroller}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              data-i={i}
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`Ampliar foto ${i + 1} de ${images.length}`}
              className="relative aspect-square min-w-full shrink-0 snap-start bg-elevated"
            >
              <Image src={img.url} alt={img.alt ?? name} fill priority={i === 0} sizes="100vw" className="object-cover" />
            </button>
          ))}
        </div>
        {badge && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-contrast">
            {badge}
          </span>
        )}
        {images.length > 1 && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === activa ? "w-5 bg-white" : "w-1.5 bg-white/55"}`} />
              ))}
            </div>
            <span className="nums pointer-events-none absolute bottom-2.5 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
              {activa + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {/* escritorio: rejilla */}
      <div className="hidden grid-cols-2 gap-2.5 md:grid">
        {images.map((img, i) => (
          <button
            key={img.url}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`Ampliar foto ${i + 1}`}
            className={`group relative overflow-hidden rounded-2xl bg-elevated ${i === 0 ? "col-span-2 aspect-[4/3]" : "aspect-square"}`}
          >
            <Image
              src={img.url}
              alt={img.alt ?? name}
              fill
              priority={i === 0}
              sizes={i === 0 ? "(max-width: 1280px) 60vw, 760px" : "(max-width: 1280px) 30vw, 380px"}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            {i === 0 && badge && (
              <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-contrast">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
