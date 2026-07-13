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
  shedron: "#a9612e",
  cognac: "#8a4a2a",
  tan: "#a9703f",
  chocolate: "#5b3520",
  oxido: "#9c4a28",
  óxido: "#9c4a28",
};

export function colorHex(name: string): string {
  const key = name.trim().toLowerCase();
  if (MAP[key]) return MAP[key];
  // multi-tone like "blanco/negro/gris" — use the first tone
  const first = key.split(/[/,-]/)[0].trim();
  return MAP[first] ?? "#9aa0a6";
}

// Swatch background: solid for one tone, a hard-stop split gradient for
// multi-tone names like "hueso/óxido".
export function swatchBg(name: string): string {
  const tones = name.split("/").map((t) => colorHex(t));
  if (tones.length === 1) return tones[0];
  const stops = tones
    .map((c, i) => `${c} ${Math.round((i / tones.length) * 100)}% ${Math.round(((i + 1) / tones.length) * 100)}%`)
    .join(", ");
  return `linear-gradient(135deg, ${stops})`;
}
