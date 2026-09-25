// ============================================================
// Combo / bundle pricing — the ONE place that computes bundle discounts.
// Mirrors the SQL in 0029_combo_group.sql (create_order). Keep them in sync.
// Model: products sharing a combo_group pool together; pairs cost a tier price
// by leather (clasico / mixto / exotico, 0066). The server RPC is billing truth.
// ============================================================

// ---- Promo markdown (mirrors promo_percent + create_order in 0036) ---------
/** Sale price after a % promo, integer cents. Unchanged when no promo. */
export function precioConPromo(cents: number, percent: number | null | undefined): number {
  if (!percent || percent <= 0) return cents;
  return Math.round((cents * (100 - percent)) / 100);
}

// Una promo cubre todo el modelo (colores null) o solo algunos colores (0065).
export type PromoEntry = { percent: number; colores: string[] | null };

/** % de promo vigente para un color del modelo, o null. Gana el mayor. */
export function promoDe(entries: PromoEntry[] | undefined, color: string | null): number | null {
  let pct = 0;
  for (const e of entries ?? []) {
    if (e.colores && !(color && e.colores.includes(color))) continue;
    pct = Math.max(pct, e.percent);
  }
  return pct > 0 ? pct : null;
}

// El precio de un par depende de la piel de los dos (0066): 0 exoticos = base,
// 1 = mixto, 2 = exotico. mixto/exotico en null caen al base (combo plano).
export type ComboConfig = { minQty: number; priceCents: number; mixtoCents: number | null; exoticoCents: number | null };
export type ComboUnit = { price: number; exotico: boolean };

/** Combo config for a product, or null when it has none / is misconfigured. */
export function comboOf(
  minQty: number | null | undefined,
  priceCents: number | null | undefined,
  mixtoCents: number | null | undefined = null,
  exoticoCents: number | null | undefined = null,
): ComboConfig | null {
  if (minQty == null || priceCents == null || minQty < 2) return null;
  return { minQty, priceCents, mixtoCents: mixtoCents ?? null, exoticoCents: exoticoCents ?? null };
}

/** Precio de un par del combo segun cuantos exoticos lleva (0, 1 o 2). */
export function precioPar(combo: ComboConfig, nExoticos: number): number {
  if (nExoticos <= 0) return combo.priceCents;
  if (nExoticos === 1) return combo.mixtoCents ?? combo.priceCents;
  return combo.exoticoCents ?? combo.priceCents;
}

/** Desde cuanto queda un combo que incluya este par: con un clasico. */
export function comboDesde(combo: ComboConfig, exotico: boolean): number {
  return precioPar(combo, exotico ? 1 : 0);
}

/** Etiqueta corta, e.g. "2x $1,999". Con `exotico`, el "desde" de ese par. */
export function comboLabel(combo: ComboConfig, fmt: (cents: number) => string, exotico = false): string {
  return `${combo.minQty}x ${fmt(comboDesde(combo, exotico))}`;
}

/**
 * Pool discount. Espejo de combo_descuento_pool (0066): con minQty = 2 arma
 * pares exotico-exotico, luego clasico-clasico, y un mixto si sobra uno de
 * cada; cada par cuesta su tarifa. Con minQty <> 2, modelo plano: cada minQty
 * unidades (las mas caras) cuestan priceCents.
 * ponytail: greedy por piel y precio desc, no busca el optimo global.
 */
export function poolDiscountCents(units: ComboUnit[], combo: ComboConfig): number {
  if (combo.minQty !== 2) {
    const pairs = Math.floor(units.length / combo.minQty);
    if (pairs <= 0) return 0;
    const paired = units.map((u) => u.price).sort((a, b) => b - a).slice(0, pairs * combo.minQty);
    return Math.max(0, paired.reduce((s, p) => s + p, 0) - pairs * combo.priceCents);
  }
  const ex = units.filter((u) => u.exotico).map((u) => u.price).sort((a, b) => b - a);
  const cl = units.filter((u) => !u.exotico).map((u) => u.price).sort((a, b) => b - a);
  let d = 0;
  while (ex.length >= 2) d += Math.max(0, ex.shift()! + ex.shift()! - precioPar(combo, 2));
  while (cl.length >= 2) d += Math.max(0, cl.shift()! + cl.shift()! - precioPar(combo, 0));
  if (ex.length === 1 && cl.length === 1) d += Math.max(0, ex[0] + cl[0] - precioPar(combo, 1));
  return d;
}

/** A combo pool: its config + the units currently in the cart for it. */
export type ComboPool = { group: string; combo: ComboConfig; units: ComboUnit[] };

export function cartComboDiscountCents(pools: ComboPool[]): number {
  return pools.reduce((sum, p) => sum + poolDiscountCents(p.units, p.combo), 0);
}

/**
 * "Add N more from the combo pool and save $X". Simula completar el siguiente
 * par con un clasico a `addPriceCents` (precio representativo del pool).
 */
export function poolNudge(
  units: ComboUnit[],
  combo: ComboConfig,
  addPriceCents: number,
): { needed: number; savingsCents: number } | null {
  if (units.length === 0) return null;
  const remainder = units.length % combo.minQty;
  if (remainder === 0) return null;
  const needed = combo.minQty - remainder;
  const extra: ComboUnit[] = Array.from({ length: needed }, () => ({ price: addPriceCents, exotico: false }));
  const after = poolDiscountCents([...units, ...extra], combo);
  const savings = after - poolDiscountCents(units, combo);
  return savings > 0 ? { needed, savingsCents: savings } : null;
}

// ---- self-check ----------------------------------------------------------
export function _demo() {
  const c: ComboConfig = { minQty: 2, priceCents: 199900, mixtoCents: 220000, exoticoCents: 240000 };
  const u = (price: number, exotico = false): ComboUnit => ({ price, exotico });
  const a = (x: boolean, m: string) => { if (!x) throw new Error(m); };
  a(poolDiscountCents([], c) === 0, "empty pool");
  a(poolDiscountCents([u(129900)], c) === 0, "one unit no discount");
  a(poolDiscountCents([u(129900), u(125900)], c) === 129900 + 125900 - 199900, "clasico");
  a(poolDiscountCents([u(125900), u(159900, true)], c) === 125900 + 159900 - 220000, "mixto");
  a(poolDiscountCents([u(169900, true), u(159900, true)], c) === 169900 + 159900 - 240000, "exotico");
  // 2 exoticos + 1 clasico: par exotico y el clasico suelto a precio lleno
  a(poolDiscountCents([u(169900, true), u(159900, true), u(125900)], c) === 169900 + 159900 - 240000, "tres");
  // sin tarifas: todo cae al base (combo plano de antes)
  const plano: ComboConfig = { minQty: 2, priceCents: 199900, mixtoCents: null, exoticoCents: null };
  a(poolDiscountCents([u(125900), u(139900, true)], plano) === 125900 + 139900 - 199900, "sin tarifas");
  const n = poolNudge([u(129900)], c, 125900);
  a(n?.needed === 1 && n.savingsCents === 129900 + 125900 - 199900, "nudge one away");
  a(poolNudge([u(129900), u(125900)], c, 125900) === null, "no nudge when complete");
  return "ok";
}
