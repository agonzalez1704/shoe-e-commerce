import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeBrand } from "@/lib/brand";

// Web Push to the admin PWA. Fire-and-forget everywhere it's used: a failed
// notification must never break an order, a payment or a webhook.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? `mailto:${activeBrand.legal.supportEmail}`;

let configured = false;
function configure() {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;  // where the notification takes you
  tag?: string;  // same tag replaces an older notification for the same subject
};

export async function notifyAdmins(payload: PushPayload): Promise<string[]> {
  try {
    return await send(payload);
  } catch (e) {
    console.error("[push] notify failed:", e); // never break the caller
    return [`error: ${e instanceof Error ? e.message : String(e)}`];
  }
}

// Devuelve una línea por dispositivo ("iPhone: OK", "Android: 403 …") y deja el
// resultado en push_subscriptions (last_sent_at / last_error) para revisarlo después.
async function send(payload: PushPayload): Promise<string[]> {
  if (!configure()) {
    console.warn("[push] VAPID keys missing — skipping:", payload.title);
    return ["Faltan las llaves VAPID en el servidor."];
  }

  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth, user_agent");
  if (!subs?.length) return ["No hay dispositivos suscritos."];

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  const ahora = new Date().toISOString();

  const res = await Promise.all(
    subs.map(async (s) => {
      const quien = /iphone|ipad/i.test(s.user_agent ?? "") ? "iPhone" : /android/i.test(s.user_agent ?? "") ? "Android" : "Otro";
      let error: string | null = null;
      try {
        // TTL: sin él web-push manda 4 semanas; urgency high para que Android
        // en ahorro de batería no la retrase.
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 86400, urgency: "high" },
        );
      } catch (e) {
        const err = e as { statusCode?: number; body?: string; message?: string };
        error = `${err.statusCode ?? "?"} ${(err.body || err.message || "").slice(0, 300)}`.trim();
        // 404/410 = the browser dropped the subscription; stop trying it
        if (err.statusCode === 404 || err.statusCode === 410) dead.push(s.endpoint);
        else console.error("[push] send failed:", error);
      }
      await admin.from("push_subscriptions").update(error ? { last_error: `${ahora} ${error}` } : { last_sent_at: ahora, last_error: null }).eq("endpoint", s.endpoint);
      return `${quien}: ${error ?? "OK"}`;
    }),
  );

  if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
  return res;
}
