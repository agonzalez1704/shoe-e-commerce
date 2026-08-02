// Developer commission: 50 MXN per pair, 100 MXN per pair from the 100th pair of
// the week onward (weekly reset). Amounts in centavos. `startCum` = pairs already
// counted earlier in the same week before this order's `pairs`.
export function commissionCents(startCum: number, pairs: number): number {
  const end = startCum + pairs;
  const at50 = Math.max(0, Math.min(end, 99) - startCum); // positions 1..99
  const at100 = pairs - at50; // positions 100+
  return at50 * 5000 + at100 * 10000;
}

// Monday (week start) of an ISO timestamp, evaluated in Mexico City time, as a
// YYYY-MM-DD key. The weekly cut runs Mon–Sun local.
export function mxWeekStart(iso: string): string {
  const local = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const dow = (local.getDay() + 6) % 7; // 0 = Monday
  local.setDate(local.getDate() - dow);
  local.setHours(0, 0, 0, 0);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---- self-check ----
export function _demo() {
  const a = (x: boolean, m: string) => { if (!x) throw new Error(m); };
  a(commissionCents(0, 1) === 5000, "1 pair = 50");
  a(commissionCents(0, 99) === 99 * 5000, "99 pairs = 50 each");
  a(commissionCents(0, 100) === 99 * 5000 + 10000, "100 pairs: 99×50 + 1×100");
  a(commissionCents(99, 1) === 10000, "pair 100 alone = 100");
  a(commissionCents(98, 3) === 5000 + 2 * 10000, "straddle 99/100/101");
  a(commissionCents(150, 2) === 2 * 10000, "past 100 all = 100");
  return "ok";
}
