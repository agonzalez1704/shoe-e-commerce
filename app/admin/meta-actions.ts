"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { sendPurchaseToMeta } from "@/lib/meta-capi";
import { SITE_URL } from "@/lib/site";

export type MetaTestResult = { ok: true; detail: string } | { ok: false; error: string };

// Fire a throwaway Purchase through the Conversions API so "Probar eventos" in
// Events Manager can confirm the server side. Without this the only way to
// exercise the CAPI is to complete a real payment.
// Returns instead of throwing: Next masks thrown server-action errors in
// production, which would hide the very message we're trying to read.
export async function sendMetaTestEvent(testEventCode: string): Promise<MetaTestResult> {
  try {
    await requireAdmin();
    const code = testEventCode.trim();
    if (!code) return { ok: false, error: "Pega el test_event_code de Events Manager." };

    // Meta rejects an event with an empty user_data, so the test carries dummy
    // contact details — hashed on the way out, same as a real purchase.
    const r = await sendPurchaseToMeta({
      eventId: `test-${code}`,
      orderNumber: `TEST-${code}`,
      email: "prueba@calzadoblade.com",
      phone: "4773791352",
      valueCents: 199900,
      sourceUrl: `${SITE_URL}/checkout`,
      testEventCode: code,
    });

    if (!r) return { ok: false, error: "Sin respuesta de Meta." };
    if ("skipped" in r) {
      return { ok: false, error: "Faltan NEXT_PUBLIC_META_PIXEL_ID o META_CAPI_ACCESS_TOKEN en Vercel." };
    }
    if (!r.ok) return { ok: false, error: `Meta rechazó el evento: ${r.detail}` };
    return { ok: true, detail: r.detail };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("[meta-test] failed:", raw);
    return { ok: false, error: raw };
  }
}
