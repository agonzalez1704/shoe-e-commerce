// Tipos y calculos de reseñas sin dependencias de servidor: los usan la ficha
// (servidor) y la lista filtrable (navegador).

export type Review = {
  id: string;
  rating: number;
  body: string | null;
  fit_feedback: "runs_small" | "true_to_size" | "runs_large" | null;
  verified_purchase: boolean;
  created_at: string;
  autor: string | null;
  ciudad: string | null;
  color: string | null;
  talla: string | null;
  fotos: string[];
  respuesta: string | null;
};

// Cupon por reseñar (honesta, buena o mala): se suma al combo, un uso.
export const CUPON_RESENA = { porcentaje: 10, dias: 90 } as const;

export type FitResumen = { chica: number; correcta: number; grande: number; total: number };

export type ReviewSummary = {
  count: number;
  average: number;
  items: Review[];
  // reseñas por estrella, [5, 4, 3, 2, 1]
  porEstrella: [number, number, number, number, number];
  fit: FitResumen;
  fotos: string[];
};

export const FIT_LABEL: Record<string, string> = {
  runs_small: "Talla chica",
  true_to_size: "Talla correcta",
  runs_large: "Talla grande",
};

// Con menos opiniones de talla que esto, un porcentaje confunde mas que ayuda.
export const FIT_MINIMO = 3;

export function resumir(items: Review[]): ReviewSummary {
  const count = items.length;
  const average = count ? items.reduce((s, r) => s + r.rating, 0) / count : 0;
  const porEstrella = [5, 4, 3, 2, 1].map((n) => items.filter((r) => r.rating === n).length) as ReviewSummary["porEstrella"];
  const conFit = items.filter((r) => r.fit_feedback);
  const pct = (k: Review["fit_feedback"]) =>
    conFit.length ? Math.round((conFit.filter((r) => r.fit_feedback === k).length / conFit.length) * 100) : 0;
  return {
    count,
    average,
    items,
    porEstrella,
    fit: { chica: pct("runs_small"), correcta: pct("true_to_size"), grande: pct("runs_large"), total: conFit.length },
    fotos: items.flatMap((r) => r.fotos ?? []),
  };
}

// "80% dice que queda fiel a su talla" en la ficha, en lugar del texto fijo,
// cuando ya hay suficientes opiniones de talla.
export function fitHint(fit: FitResumen): string | undefined {
  if (fit.total < FIT_MINIMO) return undefined;
  if (fit.correcta >= 60) return `${fit.correcta}% de los clientes dice que queda fiel a su talla — pide tu número habitual.`;
  if (fit.chica > fit.grande) return `${fit.chica}% de los clientes dice que queda chica — considera media talla más.`;
  return `${fit.grande}% de los clientes dice que queda grande — considera media talla menos.`;
}

// ---- self-check ----
export function _demo() {
  const a = (x: boolean, m: string) => { if (!x) throw new Error(m); };
  const r = (rating: number, fit: Review["fit_feedback"], fotos: string[] = []): Review => ({
    id: String(Math.random()), rating, body: null, fit_feedback: fit, verified_purchase: true, created_at: "",
    autor: null, ciudad: null, color: null, talla: null, fotos, respuesta: null,
  });
  const s = resumir([r(5, "true_to_size", ["a"]), r(4, "true_to_size"), r(5, "runs_small"), r(3, null)]);
  a(s.count === 4 && s.average === 4.25, "promedio");
  a(s.porEstrella.join() === "2,1,1,0,0", "distribucion");
  a(s.fit.total === 3 && s.fit.correcta === 67 && s.fit.chica === 33, "fit");
  a(fitHint(s.fit)!.startsWith("67%"), "hint");
  a(fitHint({ chica: 0, correcta: 100, grande: 0, total: 2 }) === undefined, "minimo");
  a(s.fotos.length === 1, "fotos");
  return "ok";
}

