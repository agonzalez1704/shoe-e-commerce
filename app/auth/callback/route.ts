import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// OAuth (Google) redirect target: exchange the code for a session, then bounce
// back to wherever the user started (?next=), defaulting to the account page.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/cuenta";

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data?.user) await mergeGuestCart(data.user.id);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

// Signing in mid-checkout must not drop the guest cart: those items live under
// the cart_token session, but a logged-in cart is keyed by customer_id. Claim
// the guest cart (or merge its items if the user already had one).
async function mergeGuestCart(userId: string) {
  try {
    const token = (await cookies()).get("cart_token")?.value;
    if (!token) return;
    const admin = createAdminClient();
    const { data: guest } = await admin.from("carts").select("id").eq("session_token", token).maybeSingle();
    if (!guest) return;
    const { data: userCart } = await admin.from("carts").select("id").eq("customer_id", userId).maybeSingle();

    if (!userCart) {
      await admin.from("carts").update({ customer_id: userId }).eq("id", guest.id);
      return;
    }
    if (userCart.id === guest.id) return;

    const { data: gItems } = await admin.from("cart_items").select("variant_id, quantity").eq("cart_id", guest.id);
    for (const it of gItems ?? []) {
      const { data: ex } = await admin
        .from("cart_items")
        .select("quantity")
        .eq("cart_id", userCart.id)
        .eq("variant_id", it.variant_id)
        .maybeSingle();
      await admin.from("cart_items").upsert(
        { cart_id: userCart.id, variant_id: it.variant_id, quantity: (ex?.quantity ?? 0) + it.quantity },
        { onConflict: "cart_id,variant_id" },
      );
    }
    await admin.from("carts").delete().eq("id", guest.id);
  } catch (e) {
    console.error("[auth callback] guest cart merge failed:", e);
  }
}
