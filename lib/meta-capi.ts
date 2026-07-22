import "server-only";

import { createHash } from "node:crypto";

// Meta Conversions API. The browser pixel misses most of our conversions: cash
// and SPEI confirm hours later (no browser around) and iOS/ad blockers drop the
// rest. This reports them server-side. event_id must match the browser event so
// Meta dedupes when both arrive.
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const API = "https://graph.facebook.com/v21.0";

// Meta requires identifiers to be SHA-256 of the normalized value — never send
// a raw email or phone.
const hash = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export type CapiPurchase = {
  eventId: string;      // our order number — the dedup key
  email?: string;
  phone?: string;       // digits only, with country code
  valueCents: number;
  orderNumber: string;
  sourceUrl?: string;
  testEventCode?: string; // Events Manager "Probar eventos" code; omit in production
};

export async function sendPurchaseToMeta(p: CapiPurchase) {
  if (!PIXEL_ID || !TOKEN) return { skipped: "no configurado" as const }; // not configured -> silently skip

  const userData: Record<string, string[]> = {};
  if (p.email) userData.em = [hash(p.email)];
  if (p.phone) {
    const digits = p.phone.replace(/\D/g, "");
    if (digits) userData.ph = [hash(digits.length === 10 ? `52${digits}` : digits)];
  }

  const body: Record<string, unknown> = {
    ...(p.testEventCode ? { test_event_code: p.testEventCode } : {}),
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: p.eventId,
        action_source: "website",
        event_source_url: p.sourceUrl,
        user_data: userData,
        custom_data: {
          value: p.valueCents / 100,
          currency: "MXN",
          order_id: p.orderNumber,
        },
      },
    ],
  };

  try {
    const res = await fetch(`${API}/${PIXEL_ID}/events?access_token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[meta-capi]", res.status, text.slice(0, 300));
      return { ok: false as const, status: res.status, detail: text.slice(0, 300) };
    }
    return { ok: true as const, detail: text.slice(0, 200) };
  } catch (e) {
    console.error("[meta-capi] send failed:", e); // never break the webhook
    return { ok: false as const, detail: e instanceof Error ? e.message : "error" };
  }
}
