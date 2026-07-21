import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Web Push to the admin PWA. Fire-and-forget everywhere it's used: a failed
// notification must never break an order, a payment or a webhook.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:pedidos@calzadoblade.com";

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

export async function notifyAdmins(payload: PushPayload) {
  try {
    await send(payload);
  } catch (e) {
    console.error("[push] notify failed:", e); // never break the caller
  }
}

async function send(payload: PushPayload) {
  if (!configure()) {
    console.warn("[push] VAPID keys missing — skipping:", payload.title);
    return;
  }

  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (!subs?.length) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = the browser dropped the subscription; stop trying it
        if (status === 404 || status === 410) dead.push(s.endpoint);
        else console.error("[push] send failed:", status, e);
      }
    }),
  );

  if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
}
