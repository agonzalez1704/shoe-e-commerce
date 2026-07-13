// Map product color names (Spanish, sometimes multi-tone "a/b/c") to a swatch
// color for the storefront. Falls back to a neutral gray for unknown names.
const MAP: Record<string, string> = {
  negro: "#141414",
  blanco: "#f3f3f0",
  moka: "#5c4030",
  maquillaje: "#e9d3c4",
  plata: "#c8ccd0",
  gris: "#9aa0a6",
  cafe: "#6b4a2f",
  café: "#6b4a2f",
  camel: "#b08a5a",
  azul: "#2b4a8b",
  marino: "#1e2a52",
  rojo: "#c0392b",
  verde: "#3a7a4a",
  beige: "#e3d5bf",
  tinto: "#5e2130",
  hueso: "#efe9dc",
};

export function colorHex(name: string): string {
  const key = name.trim().toLowerCase();
  if (MAP[key]) return MAP[key];
  // multi-tone like "blanco/negro/gris" — use the first tone
  const first = key.split(/[/,-]/)[0].trim();
  return MAP[first] ?? "#9aa0a6";
}
