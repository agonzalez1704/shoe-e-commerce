// Display helpers for payment methods. Kept framework-neutral (no "server-only")
// so both server notifications and client UI can import it.

// IMPORTANT: the internal "oxxo" key is a Conekta method name — it is NOT OXXO.
// OXXO is not part of the cash network; the voucher pays at 7-Eleven, Walmart,
// BBVA, Farmacias del Ahorro, etc. Never surface the raw "oxxo" key to a buyer or
// admin — it makes people walk into an OXXO and get turned away.
export function methodLabel(m: string): string {
  switch (m) {
    case "card": return "Tarjeta";
    case "oxxo": return "Efectivo en tiendas";
    case "spei": return "SPEI";
    case "aplazo": return "Aplazo";
    case "mercadopago": return "Mercado Pago";
    default: return m.toUpperCase();
  }
}

// The chains that accept the Conekta cash voucher (Paycash network). Full list so
// a buyer can confirm a store near them; mirrors the Conekta voucher page.
export const CASH_CHAINS = [
  "BBVA", "7-Eleven", "Farmacias del Ahorro", "Circle K", "Tiendas Extra",
  "Walmart", "Bodega Aurrerá", "Sam's Club", "Farmacia Benavides", "Soriana",
  "Waldo's", "Eleczion", "Super Kiosko", "Farmacias Bazar", "Woolworth",
  "Del Sol", "Yepas", "Farmacias De Dios", "Farmacias Nosarco",
  "Farmacias Santa Cruz", "Farmacentro", "Farmacias GyM",
  "Farmacias San Francisco de Asís", "Farmacias Unión", "Farmacias Zapotlán",
  "Farmatodo", "Alsúper",
] as const;

// Short teaser used before "y +20,000 tiendas".
export const CASH_CHAINS_SHORT =
  "7-Eleven, Walmart, Bodega Aurrerá, Circle K, Sam's Club, Farmacias del Ahorro, Soriana";
