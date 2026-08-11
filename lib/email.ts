import "server-only";

import { formatCents } from "@/lib/money";
import { activeBrand } from "@/lib/brand";
import { CASH_CHAINS_SHORT } from "@/lib/payment-method";

// Brand promises, not email plumbing: a lead time written for made-to-order
// footwear was going out to every store's customers. Unset means the sentence
// is simply omitted.
const LEAD_TIME = activeBrand.copy?.madeToOrderLine ?? "";
const ITEM = activeBrand.copy?.itemSingular ?? "pedido";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const FROM = process.env.EMAIL_FROM ?? activeBrand.emailFrom;
const ACCENT = activeBrand.theme.light.accent;
const ACCENT_CONTRAST = activeBrand.theme.light.accentContrast;

// brand-accented CTA button
function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT};color:${ACCENT_CONTRAST};text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:500;font-size:14px">${label}</a>`;
}

// Send via Resend REST API (no SDK dep). Email failures must never break checkout.
async function send(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY missing — skipping send:", subject);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) console.error("[email] resend error:", res.status, await res.text());
  } catch (e) {
    console.error("[email] send failed:", e);
  }
}

// ---- shared pieces (inline styles for email-client compatibility) ----
function shell(title: string, body: string) {
  return `<div style="background:#f4f4f5;padding:24px 12px;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden">
    <div style="padding:18px 24px;border-bottom:1px solid #eee">
      <span style="font-size:18px;font-weight:600;color:#18181b">${activeBrand.name}</span>
    </div>
    <div style="padding:24px;color:#27272a;font-size:14px;line-height:1.6">
      <h2 style="margin:0 0 12px;font-size:18px;color:${ACCENT}">${title}</h2>
      ${body}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #eee;color:#a1a1aa;font-size:12px">
      ${activeBrand.description}
    </div>
  </div>
</div>`;
}

export type EmailLine = { name: string; quantity: number; lineTotalCents: number };
export type EmailBreakdown = { subtotalCents: number; discountCents: number; shippingCents: number; taxCents: number };

function summary(lines?: EmailLine[], b?: EmailBreakdown, totalCents?: number) {
  if (!lines?.length) return "";
  const rows = lines
    .map(
      (l) => `<tr>
        <td style="padding:6px 0;color:#27272a">${l.name} <span style="color:#a1a1aa">× ${l.quantity}</span></td>
        <td style="padding:6px 0;text-align:right;color:#27272a;white-space:nowrap">${mxn(l.lineTotalCents)}</td>
      </tr>`,
    )
    .join("");
  const totalRow = (label: string, val: string, bold = false) =>
    `<tr><td style="padding:3px 0;color:${bold ? "#18181b" : "#71717a"};${bold ? "font-weight:600" : ""}">${label}</td>
      <td style="padding:3px 0;text-align:right;color:${bold ? "#18181b" : "#71717a"};${bold ? "font-weight:600" : ""}">${val}</td></tr>`;
  const breakdown = b
    ? `${totalRow("Subtotal", mxn(b.subtotalCents))}
       ${b.discountCents > 0 ? totalRow("Descuento", "- " + mxn(b.discountCents)) : ""}
       ${totalRow("Envío", b.shippingCents > 0 ? mxn(b.shippingCents) : "Gratis")}
       ${totalRow("IVA incluido", mxn(b.taxCents))}`
    : "";
  return `<table width="100%" style="border-collapse:collapse;margin:16px 0;font-size:14px">
    ${rows}
    <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px"></td></tr>
    ${breakdown}
    ${totalCents != null ? totalRow("Total", mxn(totalCents), true) : ""}
  </table>`;
}

type Base = { to: string; orderNumber: string; totalCents: number; lines?: EmailLine[]; breakdown?: EmailBreakdown };

// async payment created — buyer still needs to pay (OXXO / SPEI)
export async function sendVoucherEmail(
  a: Base & { method: "oxxo" | "spei"; reference?: string; clabe?: string; bank?: string; voucherUrl?: string; expiresAt?: string | null },
) {
  const expires = a.expiresAt ? new Date(a.expiresAt).toLocaleString("es-MX") : null;
  const instructions =
    a.method === "oxxo"
      ? `<p style="margin:0 0 8px">Paga en efectivo mostrando este código de barras (o dictando la referencia) en la caja de ${CASH_CHAINS_SHORT} y +20,000 tiendas. <strong>No es válido en OXXO.</strong></p>
         <div style="background:#fff;border:1px solid #e4e4e7;border-radius:10px;padding:16px;text-align:center">
           ${a.voucherUrl ? `<img src="${a.voucherUrl}" alt="Código de pago en efectivo" style="max-height:120px"/><br/>` : ""}
           <span style="font-family:monospace;font-size:15px;letter-spacing:1px;color:#18181b">${a.reference ?? ""}</span>
         </div>
         ${a.voucherUrl ? `<p style="margin:10px 0 0"><a href="${a.voucherUrl}" style="color:${ACCENT};font-size:13px">Ver comprobante y lista completa de tiendas →</a></p>` : ""}`
      : `<p style="margin:0 0 8px">Transfiere por SPEI a esta CLABE${a.bank ? ` (${a.bank})` : ""}:</p>
         <div style="background:#f4f4f5;border-radius:10px;padding:14px;font-family:monospace;font-size:18px;color:#18181b">${a.clabe ?? ""}</div>`;

  await send(
    a.to,
    `Pedido ${a.orderNumber} — instrucciones de pago`,
    shell(`Pedido ${a.orderNumber} recibido`,
      `<p style="margin:0 0 4px">Monto a pagar: <strong>${mxn(a.totalCents)}</strong></p>
       ${instructions}
       ${expires ? `<p style="color:#a1a1aa;font-size:13px;margin-top:12px">Vence el ${expires}.</p>` : ""}
       ${summary(a.lines, a.breakdown, a.totalCents)}
       <p style="color:#71717a">Confirmaremos tu pedido en cuanto se reciba el pago. ${LEAD_TIME}</p>`),
  );
}

// abandoned-checkout recovery — pending OXXO/SPEI still unpaid
export async function sendPaymentReminderEmail(
  a: { to: string; orderNumber: string; totalCents: number; method: "oxxo" | "spei"; reference?: string; clabe?: string; voucherUrl?: string; expiresAt?: string | null; trackUrl: string },
) {
  const expires = a.expiresAt ? new Date(a.expiresAt).toLocaleString("es-MX") : null;
  const detail =
    a.method === "oxxo"
      ? `<p style="margin:0 0 8px">Paga en efectivo con esta referencia en ${CASH_CHAINS_SHORT} y +20,000 tiendas. <strong>No es válido en OXXO.</strong></p>
         <div class="mono" style="background:#f4f4f5;border-radius:10px;padding:14px;font-family:monospace;font-size:16px;color:#18181b">${a.reference ?? ""}</div>`
      : `<p style="margin:0 0 8px">Transfiere por SPEI a esta CLABE:</p>
         <div style="background:#f4f4f5;border-radius:10px;padding:14px;font-family:monospace;font-size:18px;color:#18181b">${a.clabe ?? ""}</div>`;
  await send(
    a.to,
    `Completa tu pago — pedido ${a.orderNumber}`,
    shell(`Tu pedido sigue apartado`,
      `<p>Aún no recibimos el pago de tu pedido <strong>${a.orderNumber}</strong> por <strong>${mxn(a.totalCents)}</strong>. Complétalo antes de que venza para asegurar tu pedido.</p>
       ${detail}
       ${expires ? `<p style="color:#a1a1aa;font-size:13px;margin-top:10px">Vence el ${expires}.</p>` : ""}
       <p style="margin-top:16px">${button(a.trackUrl, "Ver mi pedido")}</p>`),
  );
}

// payment confirmed — card at checkout, or OXXO/SPEI once received
export async function sendPaidEmail(a: Base) {
  await send(
    a.to,
    `Pedido ${a.orderNumber} confirmado`,
    shell(`¡Pago confirmado!`,
      `<p>Tu pedido <strong>${a.orderNumber}</strong> está confirmado y en preparación.</p>
       ${summary(a.lines, a.breakdown, a.totalCents)}
       ${LEAD_TIME ? `<p style="color:#71717a">${LEAD_TIME}</p>` : ""}`),
  );
}

// review request — sent a few days after fulfillment, links to the tokenized form
export async function sendReviewEmail(a: { to: string; orderNumber: string; reviewUrl: string }) {
  await send(
    a.to,
    `¿Cómo te quedaron? — pedido ${a.orderNumber}`,
    shell(`Cuéntanos qué te parecieron`,
      `<p>Esperamos que estés disfrutando tu pedido <strong>${a.orderNumber}</strong>. Tu opinión ayuda a otros compradores y solo toma un minuto.</p>
       <p style="margin-top:18px">${button(a.reviewUrl, "Dejar una reseña")}</p>`),
  );
}

// order delivered — admin marked the shipment delivered
export async function sendDeliveredEmail(a: { to: string; orderNumber: string }) {
  await send(
    a.to,
    `Tu pedido ${a.orderNumber} fue entregado`,
    shell(`¡Llegó tu pedido de ${activeBrand.name}! 🎉`,
      `<p>Tu pedido <strong>${a.orderNumber}</strong> fue entregado. Gracias por confiar en ${activeBrand.name} — esperamos que lo disfrutes.</p>
       <p style="color:#71717a">En unos días te pediremos tu opinión; nos ayuda muchísimo.</p>`),
  );
}

// cash/SPEI voucher expired unpaid — the order was released, invite a retry
export async function sendExpiredEmail(a: { to: string; orderNumber: string; shopUrl: string }) {
  await send(
    a.to,
    `Tu pedido ${a.orderNumber} venció`,
    shell("Tu referencia de pago venció",
      `<p>No recibimos el pago de tu pedido <strong>${a.orderNumber}</strong> antes de la fecha límite, así que lo liberamos. No se hizo ningún cargo.</p>
       <p>Si aún lo quieres, puedes volver a ordenarlo.</p>
       <p style="margin-top:16px">${button(a.shopUrl, "Volver a la tienda")}</p>`),
  );
}

// abandoned cart — items left in a logged-in user's cart, no order placed
export async function sendAbandonedCartEmail(a: { to: string; name?: string; lines: EmailLine[]; cartUrl: string }) {
  await send(
    a.to,
    "Dejaste algo en tu carrito",
    shell(`Tu ${ITEM} te está esperando`,
      `<p>Hola${a.name ? ` ${a.name}` : ""}, guardamos lo que agregaste. Termina tu compra antes de que se agote.</p>
       ${summary(a.lines)}
       <p style="margin-top:18px">${button(a.cartUrl, "Terminar mi compra")}</p>`),
  );
}

// order shipped — admin marked it fulfilled
export async function sendShippedEmail(a: Base & { carrier?: string; tracking?: string }) {
  const track =
    a.carrier || a.tracking
      ? `<p style="margin-top:8px">Guía: <strong>${a.carrier ?? ""} ${a.tracking ?? ""}</strong></p>`
      : "";
  await send(
    a.to,
    `Pedido ${a.orderNumber} enviado`,
    shell(`Tu pedido va en camino`,
      `<p>Tu pedido <strong>${a.orderNumber}</strong> fue enviado.</p>${track}
       ${summary(a.lines, undefined, a.totalCents)}
       <p style="color:#71717a">Gracias por tu compra.</p>`),
  );
}
