import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConektaOrder } from "@/lib/conekta";

// Resume an unfinished async payment. Aplazo (and 3DS) hand the buyer off to the
// provider; if they bail out, the order sits pending with no way back. Rather
// than storing the approval URL — they expire and get reissued — ask Conekta for
// the current one each time.
export async function GET(req: NextRequest, ctx: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await ctx.params;
  const origin = req.nextUrl.origin;
  const track = NextResponse.redirect(`${origin}/rastrear?o=${encodeURIComponent(orderNumber)}`);

  // ownership check first: RLS only returns the order to the customer who owns it
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order) return NextResponse.redirect(`${origin}/cuenta`);
  if (order.status !== "pending") return track;

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("provider_charge_id")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment?.provider_charge_id) return track;

  try {
    const co = await getConektaOrder(payment.provider_charge_id);
    const pm = co.charges?.data?.[0]?.payment_method;
    const url = co.next_action?.redirect_to_url?.url ?? pm?.redirect_url;
    if (url) return NextResponse.redirect(url);
  } catch (e) {
    console.error("[pagar] could not fetch the provider order:", e);
  }
  // cash / SPEI have no approval page — the tracking view shows the reference
  return track;
}
