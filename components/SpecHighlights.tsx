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
}: {
  attributes?: Record<string, string | number | boolean>;
}) {
  const tiles = HEADLINE_SPECS.flatMap((key) => {
    const raw = attributes[key];
    if (raw === undefined || raw === null || raw === "" || typeof raw === "boolean") return [];
    return [{ key, figure: String(raw), unit: SPEC_UNITS[key] ?? "", label: SPEC_LABELS[key] }];
  }).slice(0, 4);

  if (tiles.length < 2) return null;

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
