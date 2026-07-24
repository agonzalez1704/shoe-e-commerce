import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/push";

// Vercel Cron hits this on a schedule (see vercel.json). Releases stock held by
// pending orders whose voucher/reservation window lapsed. Idempotent.
// Backstop for order.expired events the webhook never received.
// Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // grab the orders about to be expired so we can name them in the alert
  const { data: due } = await admin
    .from("orders")
    .select("order_number")
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  const { data, error } = await admin.rpc("expire_pending_orders");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const numbers = (due ?? []).map((o) => o.order_number);
  if (numbers.length) {
    await notifyAdmins({
      title: `${numbers.length} pedido${numbers.length > 1 ? "s" : ""} vencido${numbers.length > 1 ? "s" : ""}`,
      body: `Sin pago a tiempo, stock liberado: ${numbers.slice(0, 5).join(", ")}${numbers.length > 5 ? "…" : ""}`,
      url: "/admin/orders?status=cancelled",
      tag: "expired-batch",
    });
  }

  return NextResponse.json({ expired: data ?? 0 });
}
