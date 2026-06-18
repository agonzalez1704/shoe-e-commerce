// Money is integer cents everywhere. Format only at the edge.
export function formatCents(cents: number, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
