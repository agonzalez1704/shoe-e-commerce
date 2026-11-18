import "server-only";

import { formatCents } from "@/lib/money";
import { activeBrand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";
import { CUPON_RESENA } from "@/lib/reviews";
import { carrierName } from "@/lib/fulfillment";
import { CASH_CHAINS_SHORT } from "@/lib/payment-method";

// Brand promises, not email plumbing: a lead time written for made-to-order
// footwear was going out to every store's customers. Unset means the sentence
// is simply omitted.
const LEAD_TIME = activeBrand.copy?.madeToOrderLine ?? "";
const ITEM = activeBrand.copy?.itemSingular ?? "pedido";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const FROM = process.env.EMAIL_FROM ?? activeBrand.emailFrom;
// Los correos usan la plantilla oscura de la marca (shellMarca): acento del modo oscuro.
const ACCENT = activeBrand.theme.dark.accent;

// brand-accented CTA button
function button(href: string, label: string) {
  return botonMarca(href, label);
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
// Todos los correos pasan por la plantilla de marca (shellMarca, abajo).
function shell(title: string, body: string) {
  return shellMarca({
    preheader: title,
    cuerpo: `<h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.4px">${title}</h1>${body}`,
  });
}

export type EmailLine = { name: string; quantity: number; lineTotalCents: number };
export type EmailBreakdown = { subtotalCents: number; discountCents: number; shippingCents: number; taxCents: number };

function summary(lines?: EmailLine[], b?: EmailBreakdown, totalCents?: number) {
  return resumenMarca(lines, b, totalCents);
}

type Base = { to: string; orderNumber: string; totalCents: number; lines?: EmailLine[]; breakdown?: EmailBreakdown; trackUrl?: string };

// Link directo al estado del pedido: el token del pedido evita teclear numero y
// correo. Ningun correo enlazaba al rastreo y los clientes preguntaban por WhatsApp.
// Con token va a la pagina del pedido (/pedido); sin el, al formulario de rastreo.
export const linkSeguimiento = (orderNumber: string, token?: string | null) =>
  token
    ? `${SITE_URL}/pedido/${encodeURIComponent(orderNumber)}?t=${token}`
    : `${SITE_URL}/rastrear?o=${encodeURIComponent(orderNumber)}`;

const botonSeguimiento = (url?: string) =>
  url ? `<p style="margin-top:18px">${button(url, "Ver el estado de mi pedido")}</p>` : "";

const cajaLlegada = (eta: string) =>
  `<p style="margin:14px 0;padding:14px 16px;background:${M.tarjeta};border-radius:12px"><strong>Llega ${eta}.</strong>${LEAD_TIME ? `<br><span style="color:${M.suave}">${LEAD_TIME}</span>` : ""}</p>`;

// async payment created — buyer still needs to pay (OXXO / SPEI)
export async function sendVoucherEmail(
  a: Base & { method: "oxxo" | "spei"; reference?: string; clabe?: string; bank?: string; voucherUrl?: string; expiresAt?: string | null },
) {
  const expires = a.expiresAt ? new Date(a.expiresAt).toLocaleString("es-MX") : null;
  const instructions =
    a.method === "oxxo"
      ? `<p style="margin:0 0 8px">Paga en efectivo mostrando este código de barras (o dictando la referencia) en la caja de ${CASH_CHAINS_SHORT} y +20,000 tiendas. <strong>No es válido en OXXO.</strong></p>
         <div style="background:#ffffff;border-radius:12px;padding:16px;text-align:center">
           ${a.voucherUrl ? `<img src="${a.voucherUrl}" alt="Código de pago en efectivo" style="max-height:120px"/><br/>` : ""}
           <span style="font-family:monospace;font-size:15px;letter-spacing:1px;color:#18181b">${a.reference ?? ""}</span>
         </div>
         ${a.voucherUrl ? `<p style="margin:10px 0 0"><a href="${a.voucherUrl}" style="color:${ACCENT};font-size:13px">Ver comprobante y lista completa de tiendas →</a></p>` : ""}`
      : `<p style="margin:0 0 8px">Transfiere por SPEI a esta CLABE${a.bank ? ` (${a.bank})` : ""}:</p>
         <div style="background:${M.tarjeta};border-radius:12px;padding:14px 16px;font-family:${MONO};font-size:18px;letter-spacing:1px;color:${M.texto}">${a.clabe ?? ""}</div>`;

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
  a: { to: string; orderNumber: string; totalCents: number; method: "oxxo" | "spei" | "aplazo"; reference?: string; clabe?: string; voucherUrl?: string; expiresAt?: string | null; trackUrl: string },
) {
  const expires = a.expiresAt ? new Date(a.expiresAt).toLocaleString("es-MX") : null;
  // Aplazo no deja referencia ni CLABE que repetir: lo que falta es terminar la
  // solicitud, así que el correo lleva de vuelta a retomarla.
  const detail =
    a.method === "aplazo"
      ? `<p style="margin:0 0 8px">Te faltó terminar tu solicitud en Aplazo. Retómala desde tu pedido y págalo en quincenas.</p>`
      : a.method === "oxxo"
      ? `<p style="margin:0 0 8px">Paga en efectivo con esta referencia en ${CASH_CHAINS_SHORT} y +20,000 tiendas. <strong>No es válido en OXXO.</strong></p>
         <div class="mono" style="background:${M.tarjeta};border-radius:12px;padding:14px 16px;font-family:${MONO};font-size:16px;letter-spacing:1px;color:${M.texto}">${a.reference ?? ""}</div>`
      : `<p style="margin:0 0 8px">Transfiere por SPEI a esta CLABE:</p>
         <div style="background:${M.tarjeta};border-radius:12px;padding:14px 16px;font-family:${MONO};font-size:18px;letter-spacing:1px;color:${M.texto}">${a.clabe ?? ""}</div>`;
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

// ---- Crédito Blade (docs/CREDITO-BLADE.md) --------------------------------
// Plantilla de marca: oscura como la tienda, logo real y foto propia. Tablas e
// estilos en línea para Gmail/Outlook/Apple Mail. Outfit carga donde el cliente
// lo permite (Apple Mail, iOS); los demás caen a Helvetica/Arial.
export type Credito = { codigo: string; montoCents: number; venceIso: string };

const M = {
  fondo: "#0b0b0c", caja: "#141416", tarjeta: "#222226", linea: "#2a2a2e", perfora: "#46464d",
  texto: "#f4f4f5", suave: "#a1a1aa", tenue: "#71717a",
  naranja: activeBrand.theme.dark.accent, // #fb7137: con texto oscuro encima pasa AA
};
const SANS = "'Outfit','Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace";
const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City" });
const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }).replace(".", "");
const pesos = (c: number) => mxn(c).replace(/\.00$/, "");
const LOGO = activeBrand.logo
  ? `<img src="${SITE_URL}${activeBrand.logo.src}" width="104" alt="${activeBrand.logo.alt ?? activeBrand.name}" style="display:block;border:0;width:104px;height:auto">`
  : `<span style="font-family:${SANS};font-size:20px;font-weight:800;color:${M.texto}">${activeBrand.name}</span>`;
const urlCredito = (codigo: string) => `${SITE_URL}/products?credito=${encodeURIComponent(codigo)}`;

function botonMarca(href: string, label: string, contorno = false) {
  const estilo = contorno
    ? `border:1.5px solid ${M.naranja};color:${M.naranja};background:transparent`
    : `background:${M.naranja};color:${M.fondo}`;
  return `<a href="${href}" style="display:inline-block;${estilo};text-decoration:none;padding:13px 28px;border-radius:999px;font-family:${SANS};font-weight:600;font-size:15px">${label}</a>`;
}

function shellMarca(o: { preheader: string; cuerpo: string; foto?: boolean }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${M.fondo}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${o.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${M.fondo}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:0 4px 22px">${LOGO}</td></tr>
  ${o.foto ? `<tr><td><img src="${SITE_URL}/email/credito.jpg" width="560" alt="Un par de Blade en la Calzada de los Héroes, León" style="display:block;width:100%;height:auto;border:0;border-radius:18px 18px 0 0"></td></tr>` : ""}
  <tr><td style="background:${M.caja};border-radius:${o.foto ? "0 0 18px 18px" : "18px"};padding:30px 28px 32px;font-family:${SANS};color:${M.texto};font-size:15px;line-height:1.6">${o.cuerpo}</td></tr>
  <tr><td style="padding:22px 6px 0;font-family:${SANS};color:${M.tenue};font-size:12px;line-height:1.6">
    ${activeBrand.description}<br><a href="${SITE_URL}" style="color:${M.suave};text-decoration:underline">${SITE_URL.replace(/^https?:\/\//, "")}</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// La tarjeta de regalo: monto grande, talón perforado con el código y la fecha.
function tarjetaCredito(c: Credito, o: { boton?: "lleno" | "contorno" | null } = {}) {
  const boton = o.boton === undefined ? "lleno" : o.boton;
  const muesca = (lado: "left" | "right") =>
    `<td width="16" style="width:16px;padding:0"><div style="width:16px;height:32px;background:${M.caja};border-radius:${lado === "left" ? "0 16px 16px 0" : "16px 0 0 16px"}"></div></td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 6px;background:${M.tarjeta};border-radius:16px">
  <tr><td colspan="3" style="padding:22px 24px 18px">
    <p style="margin:0;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${M.naranja};font-weight:600">Crédito Blade</p>
    <p style="margin:6px 0 0;font-size:56px;line-height:1;font-weight:800;letter-spacing:-2px;color:${M.texto}">${pesos(c.montoCents)}</p>
    <p style="margin:8px 0 0;color:${M.suave};font-size:14px">Para tu próximo par. También se suma al combo de 2 pares.</p>
  </td></tr>
  <tr>${muesca("left")}<td style="padding:0 6px"><div style="border-top:2px dashed ${M.perfora};height:0;font-size:0;line-height:0">&nbsp;</div></td>${muesca("right")}</tr>
  <tr><td colspan="3" style="padding:16px 24px 22px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:${MONO};font-size:17px;letter-spacing:3px;color:${M.texto};font-weight:500">${c.codigo}</td>
      <td align="right" style="font-size:12px;color:${M.suave};white-space:nowrap">Vence<br><strong style="color:${M.texto};font-size:14px">${fechaCorta(c.venceIso)}</strong></td>
    </tr></table>
    ${boton ? `<p style="margin:18px 0 0">${botonMarca(urlCredito(c.codigo), "Usar mi crédito", boton === "contorno")}</p>` : ""}
  </td></tr>
</table>
<p style="margin:10px 0 0;font-size:12px;color:${M.tenue}">Un solo uso. Si no lo vas a usar, reenvía este correo: el código sirve a quien lo use primero.</p>`;
}

function resumenMarca(lines?: EmailLine[], b?: EmailBreakdown, totalCents?: number) {
  if (!lines?.length) return "";
  const filas = lines.map((l) => `<tr>
    <td style="padding:7px 0;color:${M.texto}">${l.name}${l.quantity > 1 ? ` <span style="color:${M.tenue}">× ${l.quantity}</span>` : ""}</td>
    <td align="right" style="padding:7px 0;color:${M.texto};white-space:nowrap">${mxn(l.lineTotalCents)}</td></tr>`).join("");
  const fila = (k: string, v: string) =>
    `<tr><td style="padding:2px 0;color:${M.tenue}">${k}</td><td align="right" style="padding:2px 0;color:${M.tenue}">${v}</td></tr>`;
  const desglose = b
    ? `<tr><td colspan="2" style="padding-top:6px;border-top:1px solid ${M.linea}"></td></tr>
       ${b.discountCents > 0 ? fila("Descuento", "- " + mxn(b.discountCents)) : ""}
       ${fila("Envío", b.shippingCents > 0 ? mxn(b.shippingCents) : "Gratis")}
       ${fila("IVA incluido", mxn(b.taxCents))}`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;font-size:14px;border-top:1px solid ${M.linea}">
    ${filas}${desglose}
    ${totalCents != null ? `<tr><td style="padding:10px 0 0;font-weight:600">Total</td>
      <td align="right" style="padding:10px 0 0;font-weight:600">${mxn(totalCents)}</td></tr>` : ""}
  </table>`;
}

export function paidEmailHtml(a: Base & { eta?: string; credito?: Credito | null }) {
  return shellMarca({
    preheader: a.credito ? `Pedido ${a.orderNumber} confirmado. Y te dejamos ${pesos(a.credito.montoCents)} para el siguiente.` : `Pedido ${a.orderNumber} confirmado.`,
    cuerpo: `<p style="margin:0;font-size:13px;color:${M.suave}">Pedido ${a.orderNumber}</p>
      <h1 style="margin:4px 0 0;font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-0.5px">Pago confirmado.</h1>
      <p style="margin:10px 0 0;color:${M.suave}">${LEAD_TIME ? "Ya empezamos a hacer tus pares." : "Ya estamos preparando tu pedido."}${a.eta ? ` Llegan <strong style="color:${M.texto}">${a.eta}</strong>.` : ""}</p>
      ${LEAD_TIME ? `<p style="margin:6px 0 0;font-size:13px;color:${M.tenue}">${LEAD_TIME}</p>` : ""}
      ${resumenMarca(a.lines, a.breakdown, a.totalCents)}
      ${a.trackUrl ? `<p style="margin:22px 0 0">${botonMarca(a.trackUrl, "Ver mi pedido")}</p>` : ""}
      ${a.credito ? `<p style="margin:34px 0 0;font-size:20px;font-weight:600;letter-spacing:-0.3px">Y un regalo para el siguiente.</p>${tarjetaCredito(a.credito, { boton: "contorno" })}` : ""}`,
  });
}

// comboCents: precio vigente del combo (de la base, al mandar); sin él se omite.
export function creditoPorVencerHtml(c: Credito & { dias: number; comboCents?: number | null }) {
  const cuando = c.dias <= 1 ? "mañana" : `en ${c.dias} días`;
  return shellMarca({
    foto: true,
    preheader: `Tu código ${c.codigo} vence el ${fechaLarga(c.venceIso)}. Después se pierde.`,
    cuerpo: `<h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-0.5px">Tus ${pesos(c.montoCents)} vencen ${cuando}.</h1>
      <p style="margin:10px 0 0;color:${M.suave}">Siguen en tu cuenta hasta el ${fechaLarga(c.venceIso)}. Después se pierden.${c.comboCents ? ` Con el combo, <strong style="color:${M.texto}">2 pares te quedan en ${pesos(c.comboCents - c.montoCents)}</strong>.` : ""}</p>
      ${tarjetaCredito(c)}`,
  });
}

export async function sendCreditoPorVencerEmail(a: Credito & { to: string; dias: number; comboCents?: number | null }) {
  await send(a.to, `Tus ${pesos(a.montoCents)} de crédito vencen ${a.dias <= 1 ? "mañana" : `en ${a.dias} días`}`, creditoPorVencerHtml(a));
}
// payment confirmed — card at checkout, or OXXO/SPEI once received
export async function sendPaidEmail(a: Base & { eta?: string; credito?: Credito | null }) {
  await send(
    a.to,
    `Pedido ${a.orderNumber} confirmado`,
    paidEmailHtml(a),
  );
}

// A mitad de la fabricacion: el tramo de ~7 dias sin noticias era el origen de
// las quejas. Un solo correo, con la fecha estimada y el link al estado.
export async function sendProductionUpdateEmail(a: { to: string; orderNumber: string; dia: number; eta: string; trackUrl: string }) {
  await send(
    a.to,
    `Pedido ${a.orderNumber}: va en fabricación`,
    shell(`Tu ${ITEM} va en fabricación`,
      `<p>Tu pedido <strong>${a.orderNumber}</strong> va en el <strong>día ${a.dia}</strong> de fabricación.</p>
       ${cajaLlegada(a.eta)}
       <p>En cuanto salga te mandamos la guía para que lo sigas con la paquetería.</p>
       ${botonSeguimiento(a.trackUrl)}`),
  );
}

// review request — sent a few days after fulfillment, links to the tokenized form
export async function sendReviewEmail(a: { to: string; orderNumber: string; reviewUrl: string }) {
  await send(
    a.to,
    `¿Cómo te quedaron? — pedido ${a.orderNumber}`,
    shell(`Cuéntanos qué te parecieron`,
      `<p>Esperamos que estés disfrutando tu pedido <strong>${a.orderNumber}</strong>. Tu opinión ayuda a otros compradores y solo toma un minuto.</p>
       <p>Deja tu reseña y comparte una foto con tus ${activeBrand.name} etiquetándonos en Instagram o Facebook: te regalamos
       <strong>${CUPON_RESENA.porcentaje}% de descuento o una cartera</strong> en tu siguiente compra, sin importar tu calificación.</p>
       <p style="margin-top:18px">${button(a.reviewUrl, "Dejar una reseña")}</p>`),
  );
}

// gracias por reseñar y compartir — cupon de un uso para la siguiente compra
export async function sendReviewCouponEmail(a: { to: string; orderNumber: string; codigo: string; cartera?: boolean }) {
  const premio = a.cartera
    ? `<strong>una cartera de regalo en tu siguiente compra</strong>: úsalo al pagar y te la enviamos junto con tus zapatos (también con el combo de 2 pares)`
    : `<strong>${CUPON_RESENA.porcentaje}% en tu siguiente compra</strong>, y se suma al combo de 2 pares`;
  await send(
    a.to,
    a.cartera
      ? "Gracias por tu reseña y tu foto — tu cartera de regalo"
      : `Gracias por tu reseña y tu foto — tu ${CUPON_RESENA.porcentaje}% para el siguiente par`,
    shell("Gracias por compartir",
      `<p>Recibimos tu reseña y tu publicación del pedido <strong>${a.orderNumber}</strong>. Como agradecimiento, este código te da
       ${premio}:</p>
       <p style="font-size:20px;margin:16px 0"><strong style="letter-spacing:1px">${a.codigo}</strong></p>
       <p style="color:#71717a">Un solo uso, válido ${CUPON_RESENA.dias} días.</p>
       <p style="margin-top:18px">${button(`${SITE_URL}/checkout?codigo=${encodeURIComponent(a.codigo)}`, "Usar mi código")}</p>`),
  );
}

// la publicacion etiquetada no se pudo validar — puede volver a enviarla
export async function sendTaggedPhotoRejectedEmail(a: { to: string; orderNumber: string; motivo: string; url: string }) {
  await send(
    a.to,
    `Tu foto del pedido ${a.orderNumber}: falta un detalle`,
    shell("No pudimos validar tu publicación",
      `<p>Gracias por compartir tus ${activeBrand.name}. No pudimos validar la publicación del pedido <strong>${a.orderNumber}</strong>${
        a.motivo ? `: ${a.motivo.replace(/[<>&]/g, "")}` : "."}</p>
       <p>Puedes enviarla de nuevo y desbloquear tu recompensa:</p>
       <p style="margin-top:18px">${button(a.url, "Enviar mi publicación")}</p>`),
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
      `<p>Hola${a.name ? ` ${a.name}` : ""}, guardamos lo que agregaste.${activeBrand.copy?.deliveryLine ? ` ${activeBrand.copy.deliveryLine}` : ""}</p>
       ${summary(a.lines)}
       <p style="margin-top:18px">${button(a.cartUrl, "Terminar mi compra")}</p>`),
  );
}

// Invitacion a completar el combo: pago exprés de la pura diferencia.
export async function sendComboInviteEmail(a: { to: string; orderNumber: string; diffCents: number; url: string }) {
  await send(
    a.to,
    `Tu segundo par por ${mxn(a.diffCents)} — pedido ${a.orderNumber}`,
    shell(`Completa tu combo 2 pares`,
      `<p>Tu pedido <strong>${a.orderNumber}</strong> incluye un par que entra en la promo de 2 pares.
        Elige el segundo modelo y paga solo <strong>${mxn(a.diffCents)}</strong> de diferencia — envío gratis.</p>
       <p style="margin-top:18px">${button(a.url, "Elegir mi segundo par")}</p>
       <p style="margin-top:14px;font-size:12px;color:#888">La liga es personal de tu pedido; si ya no te interesa, ignora este correo.</p>`),
  );
}

// Segundo y ultimo recordatorio de carrito (~48h). Trae un codigo propio del
// carrito (5%, un uso, 72h) que se SUMA al combo (suma_combo, 0069): un 10%
// que compitiera con el combo no le quitaba nada a 7 de cada 10 carritos.
// Con un solo par, el gancho es el segundo par, no el descuento.
export async function sendAbandonedCart2Email(a: {
  to: string; name?: string; lines: EmailLine[]; codigo: string;
  pares: number; comboCents: number | null; unidadCents: number;
}) {
  const con5 = (c: number) => c - Math.floor((c * 5) / 100);
  const url = `${SITE_URL}/checkout?codigo=${encodeURIComponent(a.codigo)}`;
  const codigo = `<strong style="letter-spacing:1px">${a.codigo}</strong>`;
  const hola = `Hola${a.name ? ` ${a.name}` : ""}`;
  let asunto: string, titulo: string, cuerpo: string;
  if (a.comboCents && a.pares === 1) {
    asunto = `Tu segundo par por ${mxn(a.comboCents - a.unidadCents)}`;
    titulo = "Llévate otro par";
    cuerpo = `<p>${hola}, tu par sigue apartado. Agrega otro y llévate los 2 por ${mxn(a.comboCents)};
      con tu código ${codigo} quedan en <strong>${mxn(con5(a.comboCents))}</strong>.</p>
      <p>¿Solo uno? El código también te da 5%: ${mxn(con5(a.unidadCents))}.</p>`;
  } else if (a.comboCents && a.pares === 2) {
    asunto = `Tu combo baja a ${mxn(con5(a.comboCents))}`;
    titulo = "5% extra en tu combo";
    cuerpo = `<p>${hola}, tu combo de 2 pares sigue apartado. Con tu código ${codigo} baja de
      ${mxn(a.comboCents)} a <strong>${mxn(con5(a.comboCents))}</strong>.</p>`;
  } else {
    asunto = "5% extra para terminar tu compra";
    titulo = "5% extra para ti";
    cuerpo = `<p>${hola}, tu ${ITEM} sigue apartado. Con tu código ${codigo} te llevas 5% extra sobre tu total.</p>`;
  }
  await send(
    a.to,
    asunto,
    shell(titulo,
      `${cuerpo}
       ${summary(a.lines)}
       <p style="margin-top:18px">${button(url, "Usar mi 5%")}</p>
       <p style="margin-top:14px;font-size:12px;color:#888">El código es solo tuyo, de un uso, y vence en 72 horas. Si ya compraste, ignora este correo: no volveremos a recordártelo.</p>`),
  );
}

// order shipped — admin marked it fulfilled
export async function sendShippedEmail(a: Base & { carrier?: string; tracking?: string; carrierUrl?: string; eta?: string }) {
  const track =
    a.carrier || a.tracking
      ? `<p style="margin-top:8px">Guía: <strong>${carrierName(a.carrier) ?? ""} ${a.tracking ?? ""}</strong></p>`
      : "";
  await send(
    a.to,
    `Pedido ${a.orderNumber} enviado`,
    shell(`Tu pedido va en camino`,
      `<p>Tu pedido <strong>${a.orderNumber}</strong> ya salió.${a.eta ? ` Llega <strong>${a.eta}</strong>.` : ""}</p>${track}
       ${a.carrierUrl ? `<p style="margin-top:16px">${button(a.carrierUrl, "Seguir con la paquetería")}</p>` : ""}
       ${summary(a.lines, undefined, a.totalCents)}
       ${a.trackUrl ? `<p style="margin-top:14px;font-size:13px"><a href="${a.trackUrl}" style="color:${ACCENT}">Ver el estado de mi pedido</a></p>` : ""}`),
  );
}
