"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { sendPurchaseToMeta } from "@/lib/meta-capi";
import { SITE_URL } from "@/lib/site";

// Fire a throwaway Purchase through the Conversions API so "Probar eventos" in
// Events Manager can confirm the server side. Without this the only way to
// exercise the CAPI is to complete a real payment.
export async function sendMetaTestEvent(testEventCode: string) {
  await requireAdmin();
  const code = testEventCode.trim();
  if (!code) throw new Error("Pega el test_event_code de Events Manager.");

  const r = await sendPurchaseToMeta({
    eventId: `test-${code}`,
    orderNumber: `TEST-${code}`,
    valueCents: 199900,
    sourceUrl: `${SITE_URL}/checkout`,
    testEventCode: code,
  });

  if (!r) throw new Error("Sin respuesta de Meta.");
  if ("skipped" in r) throw new Error("Faltan NEXT_PUBLIC_META_PIXEL_ID o META_CAPI_ACCESS_TOKEN en Vercel.");
  if (!r.ok) throw new Error(`Meta rechazó el evento: ${r.detail}`);
  return { detail: r.detail };
}
