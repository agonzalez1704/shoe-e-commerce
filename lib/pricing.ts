// ============================================================
// Combo / bundle pricing — the ONE place that computes bundle discounts.
// Mirrors the SQL in 0026_combo_pricing.sql (create_order). Keep them in sync:
// discount is derived from base_price so combos target same-priced colourways.
// Used by the cart summary + product UI; the server RPC is the billing truth.
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

/** Discount (cents) for `qty` units of one model at `baseCents`, given its combo. */
export function comboDiscountCents(qty: number, baseCents: number, combo: ComboConfig | null): number {
  if (!combo || qty < combo.minQty) return 0;
  const groups = Math.floor(qty / combo.minQty);
  const perGroup = combo.minQty * baseCents - combo.priceCents;
  return perGroup > 0 ? groups * perGroup : 0;
}

/** Human label for a combo offer, e.g. "2x $1,999". */
export function comboLabel(combo: ComboConfig, fmt: (cents: number) => string): string {
  return `${combo.minQty}x ${fmt(combo.priceCents)}`;
}

/**
 * How close this model is to unlocking (another) combo group.
 * Returns how many more units are needed and what that would save, or null when
 * there's no combo or the quantity already sits on a complete group.
 */
export function comboNudge(
  qty: number,
  baseCents: number,
  combo: ComboConfig | null,
): { needed: number; savingsCents: number } | null {
  if (!combo || qty <= 0) return null;
  const remainder = qty % combo.minQty;
  if (remainder === 0) return null; // already a whole group (or groups)
  const needed = combo.minQty - remainder;
  const savingsCents = comboDiscountCents(qty + needed, baseCents, combo) - comboDiscountCents(qty, baseCents, combo);
  return savingsCents > 0 ? { needed, savingsCents } : null;
}

/** Per-model quantity + combo config, used to total a whole cart. */
export type ComboGroup = { productId: string; qty: number; baseCents: number; combo: ComboConfig | null };

/** Total combo discount (cents) across a cart, summed per model. */
export function cartComboDiscountCents(groups: ComboGroup[]): number {
  return groups.reduce((sum, g) => sum + comboDiscountCents(g.qty, g.baseCents, g.combo), 0);
}
