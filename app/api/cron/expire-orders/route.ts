import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Cron hits this on a schedule (see vercel.json). Releases stock held by
// pending orders whose voucher/reservation window lapsed. Idempotent.
// Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_pending_orders");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ expired: data ?? 0 });
}
