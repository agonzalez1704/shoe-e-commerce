import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReminderEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

const HOURS_AFTER_CREATED = 12;
const BATCH = 50;

// Abandoned-checkout recovery: nudge pending OXXO/SPEI orders that are still
// payable but unpaid after N hours, once each. Bearer CRON_SECRET gated.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const cutoff = new Date(Date.now() - HOURS_AFTER_CREATED * 3600_000).toISOString();

  const { data: orders, error } = await admin
    .from("orders")
    .select("id, email, order_number, total_cents, payment_method")
    .eq("status", "pending")
    .in("payment_method", ["oxxo", "spei"])
    .is("reminder_sent_at", null)
    .lt("created_at", cutoff)
    .gt("expires_at", nowIso) // still payable
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const o of orders ?? []) {
    const { data: pay } = await admin
      .from("payments")
      .select("reference, clabe, voucher_url, expires_at")
      .eq("order_id", o.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await sendPaymentReminderEmail({
      to: o.email,
      orderNumber: o.order_number,
      totalCents: o.total_cents,
      method: o.payment_method as "oxxo" | "spei",
      reference: pay?.reference ?? undefined,
      clabe: pay?.clabe ?? undefined,
      voucherUrl: pay?.voucher_url ?? undefined,
      expiresAt: pay?.expires_at ?? null,
      trackUrl: `${SITE_URL}/rastrear`,
    });
    await admin.from("orders").update({ reminder_sent_at: nowIso }).eq("id", o.id);
    sent++;
  }

  return NextResponse.json({ sent });
}
