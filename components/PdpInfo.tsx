import { CaretDown, Truck, Ruler, Leaf, Gauge } from "@phosphor-icons/react/dist/ssr";
import { activeBrand } from "@/lib/brand";
import { specLabel, specValue, sortedSpecs } from "@/lib/specs";

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-border py-1">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
        <Icon size={18} className="shrink-0 text-accent" />
        {title}
        <CaretDown size={15} className="ml-auto text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pl-[30px] pr-1 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  );
}

// Emphasis inside a config string: *gratis* → <span class="text-text">gratis</span>.
// The bullets carried inline JSX before they moved to BrandConfig, and dropping
// the highlight would have quietly restyled Blade's live PDP.
function em(s: string) {
  return s.split(/\*([^*]+)\*/g).map((part, i) =>
    i % 2 ? <span key={i} className="text-text">{part}</span> : part,
  );
}

// `sized` / `madeToOrder` stay product-level: a size chart in MX/cm and a
// made-to-order lead time are facts about the item, not about the store. The
// brand-level copy around them now comes from BrandConfig, and a block whose
// copy is unset does not render at all.
export function PdpInfo({
  sized = true,
  madeToOrder = true,
  attributes = {},
}: {
  sized?: boolean;
  madeToOrder?: boolean;
  attributes?: Record<string, string | number | boolean>;
}) {
  const specs = sortedSpecs(attributes);
  const pdp = activeBrand.pdp;
  // The lead-time and size-exchange lines only apply to the kind of product they
  // describe; the rest are brand-wide. Order matches what shipped before.
  const bullets = [
    pdp?.shipping?.[0],
    madeToOrder ? pdp?.shippingMadeToOrder : null,
    sized ? pdp?.shippingSized : null,
    ...(pdp?.shipping?.slice(1) ?? []),
  ].filter(Boolean) as string[];
  return (
    <div className="mt-8" id="size-guide">
      {bullets.length > 0 && (
        <Section icon={Truck} title="Envío y devoluciones">
          <ul className="space-y-1.5">
            {bullets.map((b) => <li key={b}>{em(b)}</li>)}
          </ul>
        </Section>
      )}

      {/* Sized AND the brand has a chart: the MX/cm/US table is a shoe
          conversion, so a store whose sized items are helmets shows none. */}
      {sized && pdp?.sizeGuide && (
      <Section icon={Ruler} title="Guía de tallas">
        <p>{em(pdp.sizeGuide.intro)}</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-elevated text-muted">
              <tr><th className="px-3 py-2">MX</th><th className="px-3 py-2">Largo (cm)</th><th className="px-3 py-2">US</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pdp.sizeGuide.rows.map((r) => (
                <tr key={r.mx}>
                  <td className="nums px-3 py-2 font-medium text-text">{r.mx}</td>
                  <td className="nums px-3 py-2">{r.cm}</td>
                  <td className="nums px-3 py-2">{r.us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs">{pdp.sizeGuide.note}</p>
      </Section>
      )}

      {specs.length > 0 ? (
        <Section icon={Gauge} title="Especificaciones">
          <dl className="divide-y divide-border">
            {specs.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-2">
                <dt>{specLabel(k)}</dt>
                <dd className="nums text-right font-medium text-text">{specValue(v, k)}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : pdp?.care ? (
        <Section icon={Leaf} title={pdp.care.title}>
          <ul className="space-y-1.5">
            {pdp.care.items.map((t) => <li key={t}>{em(t)}</li>)}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
