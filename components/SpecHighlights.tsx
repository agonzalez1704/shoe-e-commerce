import { HEADLINE_SPECS, SPEC_LABELS, SPEC_UNITS } from "@/lib/specs";

// The two or three numbers a buyer actually decides on — range, top speed,
// battery — set in big type above the fold, instead of buried in a collapsed
// accordion three screens down.
//
// Renders nothing below two tiles. Coverage on the real catalogue is uneven
// (speed 86%, range 83%, battery 38%, load 20%), so 16 products have no specs
// at all and 3 have exactly one; a single lonely tile reads as a bug, and an
// absent block reads as a product that simply has no headline figures.
export function SpecHighlights({
  attributes = {},
  variant = "tiles",
}: {
  attributes?: Record<string, string | number | boolean>;
  // "band" is the full-bleed treatment on the showcase layout: the same data,
  // set at the scale the reference site gives it. Same source, one component.
  variant?: "tiles" | "band";
}) {
  const tiles = HEADLINE_SPECS.flatMap((key) => {
    const raw = attributes[key];
    if (raw === undefined || raw === null || raw === "" || typeof raw === "boolean") return [];
    return [{ key, figure: String(raw), unit: SPEC_UNITS[key] ?? "", label: SPEC_LABELS[key] }];
  }).slice(0, 4);

  if (tiles.length < 2) return null;

  if (variant === "band") {
    return (
      <ul className={`grid grid-cols-2 ${tiles.length > 2 ? "md:grid-cols-4" : "md:grid-cols-2"}`}>
        {tiles.map((t) => (
          <li
            key={t.key}
            // Hairlines only between cells, never on the outer edge: the band
            // runs to the viewport edge and a border there reads as a mistake.
            className="border-b border-r border-border/60 px-5 py-7 last:border-r-0 sm:px-8 sm:py-10 md:border-b-0 [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r [&:last-child]:border-r-0"
          >
            <p className="flex items-baseline gap-1.5">
              <span className={`nums font-semibold leading-none tracking-tight ${t.figure.length > 4 ? "text-2xl sm:text-4xl" : "text-4xl sm:text-6xl"}`}>
                {t.figure}
              </span>
              {t.unit && <span className="text-sm font-medium text-muted sm:text-base">{t.unit}</span>}
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted sm:text-xs">{t.label}</p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <li key={t.key} className="rounded-xl border border-border bg-elevated/60 px-3 py-3 text-center">
          <p className="flex items-baseline justify-center gap-1">
            {/* `bateria` is free text ("48V 20Ah") rather than a number, so it
                steps down a size to keep the tiles the same height. */}
            <span className={`nums font-semibold leading-none ${t.figure.length > 4 ? "text-lg" : "text-2xl"}`}>
              {t.figure}
            </span>
            {t.unit && <span className="text-xs font-medium text-muted">{t.unit}</span>}
          </p>
          <p className="mt-1.5 text-[11px] leading-tight text-muted">{t.label}</p>
        </li>
      ))}
    </ul>
  );
}
