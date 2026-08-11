"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { HeroSlide } from "@/lib/brand";

// Hero carousel on CSS scroll-snap — no carousel dependency.
//
// Native overflow scrolling gives arrow keys, Home/End, VoiceOver and TalkBack
// swipe navigation and trackpad momentum for free, and it degrades to a
// scrollable strip if the JS never runs. A transform-based carousel has to
// reimplement all of that and degrades to a single visible slide.
//
// No autoplay, deliberately: WCAG 2.2.2 would require a visible pause control,
// it fights scroll-snap on touch, and it is the single thing that makes a
// carousel feel cheap.
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // One observer over the slides keeps the dots honest whatever moved the
  // scroller — swipe, arrow key, dot, or trackpad.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { root: el, threshold: 0.6 },
    );
    for (const child of el.children) io.observe(child);
    return () => io.disconnect();
  }, [slides.length]);

  const goTo = (i: number) => {
    const el = scroller.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    // `block: "nearest"` matters — without it the page jumps vertically to
    // bring the hero into view every time a dot is pressed.
    slide?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  return (
    <section
      className="relative ml-[calc(50%-50vw)] w-screen"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Destacados"
    >
      <div
        ref={scroller}
        tabIndex={0}
        // overscroll-x-contain is load-bearing on iOS: without it a horizontal
        // swipe on the first slide triggers browser back-navigation.
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none"
      >
        {slides.map((s, i) => (
          <div
            key={i}
            data-i={i}
            role="group"
            aria-roledescription="diapositiva"
            aria-label={`${i + 1} de ${slides.length}`}
            className="relative aspect-[4/5] min-w-full shrink-0 snap-start overflow-hidden sm:aspect-[16/9]"
          >
            <Slide s={s} priority={i === 0} />
          </div>
        ))}
      </div>

      {/* arrows: a mouse cannot swipe */}
      <button
        type="button"
        onClick={() => goTo(Math.max(0, active - 1))}
        disabled={active === 0}
        aria-label="Anterior"
        className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-opacity hover:bg-black/60 disabled:opacity-0 md:grid"
      >
        <CaretLeft size={20} weight="bold" />
      </button>
      <button
        type="button"
        onClick={() => goTo(Math.min(slides.length - 1, active + 1))}
        disabled={active === slides.length - 1}
        aria-label="Siguiente"
        className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-opacity hover:bg-black/60 disabled:opacity-0 md:grid"
      >
        <CaretRight size={20} weight="bold" />
      </button>

      {/* dots — 44px hit area even though the mark is small */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1 sm:bottom-5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Ir a la diapositiva ${i + 1}`}
            aria-current={i === active}
            className="grid h-11 w-8 place-items-center"
          >
            <span
              className={`block h-1.5 rounded-full transition-all ${
                i === active ? "w-6 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

function Slide({ s, priority }: { s: HeroSlide; priority: boolean }) {
  // Two layouts, because two kinds of art exist.
  //
  // A lifestyle photo fills the frame and the copy sits on top of a scrim.
  // A catalogue shot cannot: these are not transparent cut-outs, they are
  // product photos with a white background baked in, so overlaying text puts
  // white type on a white rectangle. Those get a split instead — picture and
  // copy in separate bands, no overlap and nothing to make legible.
  const split = s.fit === "contain";
  const copy = (
    <>
      <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${split ? "text-accent" : "text-white/80"}`}>
        {s.eyebrow}
      </p>
      <h2
        className={`mt-2 max-w-2xl text-3xl font-semibold leading-[1.02] tracking-tight sm:mt-3 sm:text-5xl md:text-6xl ${
          split ? "text-text" : "text-white drop-shadow-sm"
        }`}
      >
        {s.titleTop}
        {s.titleBottom && (
          <>
            <br />
            {s.titleBottom}
          </>
        )}
      </h2>
      {s.body && (
        <p
          className={`mt-2.5 max-w-sm text-sm leading-relaxed sm:mt-4 sm:max-w-md sm:text-base ${
            split ? "text-muted" : "text-white/85"
          }`}
        >
          {s.body}
        </p>
      )}
      {s.ctaHref && (
        <div className="mt-4 sm:mt-6">
          <Link
            href={s.ctaHref}
            className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-transform active:scale-[0.98]"
          >
            {s.ctaLabel}
            <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </>
  );

  if (split) {
    return (
      <div className="absolute inset-0 grid grid-rows-[1fr_auto] sm:grid-cols-2 sm:grid-rows-1">
        {/* the white of the photo becomes a deliberate panel instead of an
            accident; on desktop it takes the right half */}
        <div className="relative order-1 bg-white sm:order-2">
          <Image src={s.image} alt="" fill priority={priority} sizes="(max-width: 640px) 100vw, 50vw" className="object-contain p-4 sm:p-8" />
        </div>
        <div className="order-2 flex flex-col justify-center px-5 pb-14 pt-4 sm:order-1 sm:pb-0 sm:pl-[max(1.25rem,calc((100vw-72rem)/2))] sm:pr-8">
          {copy}
        </div>
      </div>
    );
  }

  return (
    <>
      <Image
        src={s.image}
        alt=""
        fill
        priority={priority}
        sizes="100vw"
        style={s.focal ? { objectPosition: s.focal } : undefined}
        className="object-cover object-center"
      />
      {/* legibility scrim: darker toward the lower-left where the copy sits */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent" />
      <div className="absolute inset-0 flex items-end sm:items-center">
        <div className="mx-auto flex w-full max-w-6xl flex-col px-5 pb-16 sm:pb-0">{copy}</div>
      </div>
    </>
  );
}
