// Product spec vocabulary. Lives outside the components because both the PDP's
// spec table (a server component) and the headline tiles (inside a client one)
// read it — importing it from PdpInfo would drag its `/dist/ssr` icon imports
// into the client bundle.
//
// Keys are stored as authored (motor_w, autonomia_km). Known ones get a proper
// label and unit; anything else is humanised rather than dropped, so a new
// category can add specs without a code change.
export const SPEC_LABELS: Record<string, string> = {
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

export const SPEC_UNITS: Record<string, string> = {
  motor_w: "W",
  velocidad_max_kmh: "km/h",
  autonomia_km: "km",
  capacidad_kg: "kg",
  llanta_pulgadas: '"',
  peso_kg: "kg",
  tiempo_carga_h: "h",
};

// The specs worth setting in big type at the top of the page. Deliberately a
// list and not "everything with a unit": a buyer decides on range and speed,
// not on weight, and a free-text key like `modelo` set as a headline figure
// reads like a mistake. Order is the order the tiles appear in.
export const HEADLINE_SPECS = [
  "motor_w",
  "velocidad_max_kmh",
  "autonomia_km",
  "bateria",
  "capacidad_kg",
] as const;

export const specLabel = (k: string) =>
  SPEC_LABELS[k] ?? k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function specValue(v: string | number | boolean, key = "") {
  if (typeof v === "boolean") return v ? "Sí" : "No";
  const unit = SPEC_UNITS[key];
  return unit ? `${v} ${unit}`.replace(' "', '"') : String(v);
}

// JSONB has no key order, so an unsorted table shuffles between products.
// Known specs follow SPEC_LABELS (headline figures first); the rest trail them.
export function sortedSpecs(attributes: Record<string, string | number | boolean>) {
  const order = Object.keys(SPEC_LABELS);
  const rank = (k: string) => (order.indexOf(k) === -1 ? order.length : order.indexOf(k));
  return Object.entries(attributes)
    .filter(([, v]) => v !== null && v !== "")
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}
