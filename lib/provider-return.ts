// Interpreting a payment provider's return-to-store URL.
//
// MercadoPago's "Volver a la tienda" link on its payment picker points at our
// failure URL with status/collection_status/payment_id = "null": the buyer never
// paid, they just backed out. Treating that as a decline cancelled live orders,
// so a decline needs real evidence.

export type ReturnParams = {
  order_id?: string;          // Conekta charge id (proves a real Conekta return)
  payment_status?: string;    // our own flag / Conekta
  status?: string;            // MercadoPago
  collection_status?: string; // MercadoPago
  payment_id?: string;        // MercadoPago
};

export const isSet = (v?: string) => !!v && v !== "null" && v !== "undefined";

export function isDeclined(p: ReturnParams): boolean {
  const mp = isSet(p.collection_status) ? p.collection_status! : isSet(p.status) ? p.status! : null;
  if (mp) return /rejected|cancelled|canceled|failure|error/i.test(mp);
  if (isSet(p.payment_id)) return false; // MP has a payment: approved or pending, not a decline
  return isSet(p.order_id) && /error|declined|failed|denied/i.test(p.payment_status ?? "");
}

// ---- self-check ----
export function _demo() {
  const a = (x: boolean, m: string) => { if (!x) throw new Error(m); };
  // MercadoPago "Volver a la tienda": our flag says failed, MP says nothing happened
  a(!isDeclined({ payment_status: "failed", status: "null", collection_status: "null", payment_id: "null" }),
    "back-to-store must NOT count as declined");
  a(!isDeclined({ payment_status: "failed" }), "bare failure flag without evidence is not a decline");
  // real MercadoPago rejection
  a(isDeclined({ collection_status: "rejected", payment_id: "123" }), "MP rejected is a decline");
  a(isDeclined({ status: "rejected" }), "MP status rejected is a decline");
  // MercadoPago success / pending voucher
  a(!isDeclined({ collection_status: "approved", payment_id: "123" }), "approved is not a decline");
  a(!isDeclined({ collection_status: "pending", payment_id: "123" }), "pending is not a decline");
  // Conekta card 3DS decline: has the charge id
  a(isDeclined({ order_id: "ord_abc", payment_status: "declined" }), "Conekta decline with charge id");
  a(!isDeclined({ order_id: "ord_abc", payment_status: "paid" }), "Conekta paid is not a decline");
  return "ok";
}
