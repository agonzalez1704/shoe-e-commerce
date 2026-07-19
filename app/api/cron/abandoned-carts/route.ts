import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAbandonedCartEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

const HOURS_AFTER = 4;
const BATCH = 50;

// Nudge logged-in users who left items in their cart and didn't check out.
// Guests have no email until checkout, so they're out of scope. Once per cart
// (abandoned_email_sent_at). ponytail: one-shot per cart; no re-nudge if they
// re-add later — fine until it measurably matters.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - HOURS_AFTER * 3600_000).toISOString();

  const { data: items, error } = await admin
    .from("cart_items")
    .select(
      "quantity, cart:carts!inner(id, customer_id, abandoned_email_sent_at, updated_at, customer:customers!inner(email, full_name)), " +
        "variant:variants(price_cents, product:products(name, base_price_cents))",
    )
    .not("cart.customer_id", "is", null)
    .is("cart.abandoned_email_sent_at", null)
    .lt("cart.updated_at", cutoff)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // group rows by cart
  type Row = {
    quantity: number;
    cart: { id: string; abandoned_email_sent_at: string | null; customer: { email: string; full_name: string | null } };
    variant: { price_cents: number | null; product: { name: string; base_price_cents: number } };
  };
  const carts = new Map<string, { email: string; name: string | null; lines: { name: string; quantity: number; lineTotalCents: number }[] }>();
  for (const r of (items ?? []) as unknown as Row[]) {
    const c = carts.get(r.cart.id) ?? { email: r.cart.customer.email, name: r.cart.customer.full_name, lines: [] };
    const unit = r.variant.price_cents ?? r.variant.product.base_price_cents;
    c.lines.push({ name: r.variant.product.name, quantity: r.quantity, lineTotalCents: unit * r.quantity });
    carts.set(r.cart.id, c);
  }

  let sent = 0;
  for (const [cartId, c] of [...carts].slice(0, BATCH)) {
    await sendAbandonedCartEmail({ to: c.email, name: c.name ?? undefined, lines: c.lines, cartUrl: `${SITE_URL}/cart` });
    await admin.from("carts").update({ abandoned_email_sent_at: new Date().toISOString() }).eq("id", cartId);
    sent++;
  }
  return NextResponse.json({ sent });
}
