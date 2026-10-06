import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

const DAYS_AFTER_FULFILLED = 5;
const BATCH = 50;

// Sends the review-request email to buyers ~5 days after delivery, once per
// order. Only delivered orders can be reviewed, so shipped-only ones wait. Keyed off the
// real fulfillment dates, not `updated_at` (which any admin edit would bump).
// Scheduled (see DEPLOY.md). Bearer CRON_SECRET gated.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - DAYS_AFTER_FULFILLED * 86400_000).toISOString();

  const { data: orders, error } = await admin
    .from("orders")
    .select("id, email, order_number, review_token")
    .is("review_request_sent_at", null)
    .not("status", "in", "(cancelled,refunded)")
    .lt("delivered_at", cutoff)
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const o of orders ?? []) {
    await sendReviewEmail({
      to: o.email,
      orderNumber: o.order_number,
      reviewUrl: `${SITE_URL}/resena/${o.review_token}`,
    });
    await admin.from("orders").update({ review_request_sent_at: new Date().toISOString() }).eq("id", o.id);
    sent++;
  }

  return NextResponse.json({ sent });
}
