// ============================================================
// Combo / bundle pricing — the ONE place that computes bundle discounts.
// Mirrors the SQL in 0029_combo_group.sql (create_order). Keep them in sync.
// Model: products sharing a combo_group pool together; every `minQty` units
// across the pool (mix models) cost `priceCents`. The server RPC is billing truth.
// ============================================================

export type ComboConfig = { minQty: number; priceCents: number };

/** Combo config for a product, or null when it has none / is misconfigured. */
export function comboOf(
  minQty: number | null | undefined,
  priceCents: number | null | undefined,
): ComboConfig | null {
  if (minQty == null || priceCents == null || minQty < 2) return null;
  return { minQty, priceCents };
}

/** Human label for a combo offer, e.g. "2x $1,999". */
export function comboLabel(combo: ComboConfig, fmt: (cents: number) => string): string {
  return `${combo.minQty}x ${fmt(combo.priceCents)}`;
}

/**
 * Pool discount: given the individual unit prices in one combo pool, every
 * `minQty` units cost `priceCents`. Pairs are formed from the most-expensive
 * units (best deal for the buyer); the cheapest leftover stays at full price.
 * Matches the SQL window in create_order.
 */
export function poolDiscountCents(unitPrices: number[], combo: ComboConfig): number {
  const pairs = Math.floor(unitPrices.length / combo.minQty);
  if (pairs <= 0) return 0;
  const paired = [...unitPrices].sort((a, b) => b - a).slice(0, pairs * combo.minQty);
  return Math.max(0, paired.reduce((s, p) => s + p, 0) - pairs * combo.priceCents);
}

/** A combo pool: its config + the unit prices currently in the cart for it. */
export type ComboPool = { group: string; combo: ComboConfig; unitPrices: number[] };

export function cartComboDiscountCents(pools: ComboPool[]): number {
  return pools.reduce((sum, p) => sum + poolDiscountCents(p.unitPrices, p.combo), 0);
}

/**
 * "Add N more from the combo pool and save $X". Simulates completing the next
 * pair with a unit at `addPriceCents` (a representative pool price).
 */
export function poolNudge(
  unitPrices: number[],
  combo: ComboConfig,
  addPriceCents: number,
): { needed: number; savingsCents: number } | null {
  if (unitPrices.length === 0) return null;
  const remainder = unitPrices.length % combo.minQty;
  if (remainder === 0) return null;
  const needed = combo.minQty - remainder;
  const after = poolDiscountCents([...unitPrices, ...Array(needed).fill(addPriceCents)], combo);
  const savings = after - poolDiscountCents(unitPrices, combo);
  return savings > 0 ? { needed, savingsCents: savings } : null;
}

// ---- self-check ----------------------------------------------------------
export function _demo() {
  const c: ComboConfig = { minQty: 2, priceCents: 199900 };
  const a = (x: boolean, m: string) => { if (!x) throw new Error(m); };
  a(poolDiscountCents([], c) === 0, "empty pool");
  a(poolDiscountCents([129900], c) === 0, "one unit no discount");
  // 2 mixed models 1299 + 1259 = 2558 → pay 1999 → save 559
  a(poolDiscountCents([129900, 125900], c) === 129900 + 125900 - 199900, "pair discount");
  // 3 units: 1 pair (top two) + cheapest leftover full
  a(poolDiscountCents([129900, 129900, 125900], c) === 129900 + 129900 - 199900, "3 units = 1 pair");
  // 4 units → 2 pairs
  a(poolDiscountCents([129900, 129900, 125900, 125900], c) === (129900+129900+125900+125900) - 2*199900, "4 units = 2 pairs");
  const n = poolNudge([129900], c, 125900);
  a(n?.needed === 1 && n.savingsCents === 129900 + 125900 - 199900, "nudge one away");
  a(poolNudge([129900, 125900], c, 125900) === null, "no nudge when complete");
  return "ok";
}
