import { CaretDown, Truck, Ruler, Leaf, Gauge } from "@phosphor-icons/react/dist/ssr";

// Spec keys are stored as they are authored (motor_w, autonomia_km). Known ones
// get a proper label and unit; anything else is humanised rather than dropped,
// so a new category can add specs without a code change.
const SPEC_LABELS: Record<string, string> = {
  motor_w: "Motor",
  velocidad_max_kmh: "Velocidad máxima",
  autonomia_km: "Autonomía",
  bateria: "Batería",
  capacidad_kg: "Capacidad de carga",
  llanta_pulgadas: "Llantas",
  peso_kg: "Peso",
  plegable: "Plegable",
  tiempo_carga_h: "Tiempo de carga",
  frenos: "Frenos",
};
const SPEC_UNITS: Record<string, string> = {
  motor_w: "W",
  velocidad_max_kmh: "km/h",
  autonomia_km: "km",
  capacidad_kg: "kg",
  llanta_pulgadas: '"',
  peso_kg: "kg",
  tiempo_carga_h: "h",
};

const specLabel = (k: string) =>
  SPEC_LABELS[k] ?? k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function specValue(v: string | number | boolean, key = "") {
  if (typeof v === "boolean") return v ? "Sí" : "No";
  const unit = SPEC_UNITS[key];
  return unit ? `${v} ${unit}`.replace(' "', '"') : String(v);
}

// MX sizing ≈ foot length in cm; US is an approximate conversion.
const SIZE_ROWS = [
  { mx: "25", cm: "25.0", us: "7" },
  { mx: "26", cm: "26.0", us: "8" },
  { mx: "27", cm: "27.0", us: "9" },
  { mx: "28", cm: "28.0", us: "10" },
  { mx: "29", cm: "29.0", us: "11" },
  { mx: "30", cm: "30.0", us: "12" },
];

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

// `sized` / `madeToOrder` come from the product because these blocks are shoe
// copy: a size chart in MX/cm and a made-to-order lead time mean nothing on a
// scooter. Gating them is the stopgap — the real fix is moving this copy into
// BrandConfig alongside the homepage blocks.
export function PdpInfo({
  sized = true,
  madeToOrder = true,
  attributes = {},
}: {
  sized?: boolean;
  madeToOrder?: boolean;
  attributes?: Record<string, string | number | boolean>;
}) {
  // JSONB gives no key order, so the table would shuffle between products.
  // Known specs follow SPEC_LABELS (headline figures first); the rest trail it.
  const order = Object.keys(SPEC_LABELS);
  const rank = (k: string) => (order.indexOf(k) === -1 ? order.length : order.indexOf(k));
  const specs = Object.entries(attributes)
    .filter(([, v]) => v !== null && v !== "")
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  return (
    <div className="mt-8" id="size-guide">
      <Section icon={Truck} title="Envío y devoluciones">
        <ul className="space-y-1.5">
          <li>Envío <span className="text-text">gratis</span> a todo México.</li>
          {madeToOrder && (
            <li>Hecho sobre pedido: se fabrica y entrega en <span className="text-text">4 a 7 días hábiles</span>.</li>
          )}
          {sized && <li>Primer cambio de talla <span className="text-text">sin costo</span>.</li>}
          <li>Devoluciones dentro de los 30 días posteriores a la entrega.</li>
        </ul>
      </Section>

      {sized && (
      <Section icon={Ruler} title="Guía de tallas">
        <p>Nuestro calzado <span className="text-text">queda fiel a tu talla</span>: pide tu número mexicano habitual.</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-elevated text-muted">
              <tr><th className="px-3 py-2">MX</th><th className="px-3 py-2">Largo (cm)</th><th className="px-3 py-2">US</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SIZE_ROWS.map((r) => (
                <tr key={r.mx}>
                  <td className="nums px-3 py-2 font-medium text-text">{r.mx}</td>
                  <td className="nums px-3 py-2">{r.cm}</td>
                  <td className="nums px-3 py-2">{r.us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs">Mide tu pie de talón a punta y elige el cm más cercano. ¿Dudas? Escríbenos.</p>
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
      ) : (
        <Section icon={Leaf} title="Materiales y cuidado">
          <ul className="space-y-1.5">
            <li>Piel <span className="text-text">genuina</span>, hecha a mano.</li>
            <li>Suela Phylon ultra ligera.</li>
            <li>Limpia con un paño suave húmedo; evita sol directo y calor.</li>
            <li>Usa horma y guarda en lugar fresco y seco para conservar la forma.</li>
          </ul>
        </Section>
      )}
    </div>
  );
}
