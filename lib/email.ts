import "server-only";

import { formatCents } from "@/lib/money";
import { activeBrand } from "@/lib/brand";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const FROM = process.env.EMAIL_FROM ?? activeBrand.emailFrom;

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

function shell(title: string, body: string) {
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;color:#18181b">
    <h1 style="font-size:20px;font-weight:600">${activeBrand.name}</h1>
    <h2 style="font-size:16px;font-weight:600;margin-top:24px">${title}</h2>
    ${body}
    <p style="color:#71717a;font-size:12px;margin-top:32px">Calzado para cada paso. Envíos a todo México.</p>
  </div>`;
}

type Base = { to: string; orderNumber: string; totalCents: number };

// async payment created — buyer still needs to pay (OXXO/SPEI)
export async function sendVoucherEmail(
  a: Base & {
    method: "oxxo" | "spei";
    reference?: string;
    clabe?: string;
    voucherUrl?: string;
    expiresAt?: string | null;
  },
) {
  const expires = a.expiresAt ? new Date(a.expiresAt).toLocaleString("es-MX") : null;
  const instructions =
    a.method === "oxxo"
      ? `<p>Paga en cualquier OXXO con esta referencia:</p>
         <p style="font-size:22px;font-family:monospace;background:#f4f4f5;padding:12px;border-radius:8px">${a.reference ?? ""}</p>
         ${a.voucherUrl ? `<p><a href="${a.voucherUrl}">Ver / imprimir voucher</a></p>` : ""}`
      : `<p>Transfiere ${mxn(a.totalCents)} a esta CLABE:</p>
         <p style="font-size:20px;font-family:monospace;background:#f4f4f5;padding:12px;border-radius:8px">${a.clabe ?? ""}</p>`;

  await send(
    a.to,
    `Pedido ${a.orderNumber} — instrucciones de pago`,
    shell(`Pedido ${a.orderNumber} recibido`,
      `<p>Total: <strong>${mxn(a.totalCents)}</strong></p>${instructions}
       ${expires ? `<p style="color:#71717a;font-size:13px">Vence el ${expires}.</p>` : ""}
       <p>Confirmaremos tu pedido en cuanto se reciba el pago.</p>`),
  );
}

// payment confirmed — card at checkout, or OXXO/SPEI once received
export async function sendPaidEmail(a: Base) {
  await send(
    a.to,
    `Pedido ${a.orderNumber} confirmado`,
    shell(`¡Pago confirmado!`,
      `<p>Tu pedido <strong>${a.orderNumber}</strong> por <strong>${mxn(a.totalCents)}</strong> está confirmado.</p>
       <p>Te avisaremos cuando se envíe.</p>`),
  );
}
