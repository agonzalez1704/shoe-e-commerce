import { redirect } from "next/navigation";
import { getCart } from "@/app/cart/actions";
import { CheckoutForm, type CheckoutDefaults } from "@/components/CheckoutForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Prefill from the signed-in user: name/email from the auth profile, the rest
// from their most recent order's shipping address.
async function checkoutDefaults(): Promise<CheckoutDefaults> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const defaults: CheckoutDefaults = {
    email: user.email ?? undefined,
    name: (user.user_metadata?.full_name as string | undefined) ?? undefined,
  };

  const { data: last } = await supabase
    .from("orders")
    .select("shipping_address")
    .eq("email", user.email ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const s = (last?.shipping_address ?? null) as Record<string, string> | null;
  if (s) {
    defaults.name ??= s.name;
    defaults.phone = s.phone;
    defaults.line1 = s.line1;
    defaults.neighborhood = s.neighborhood;
    defaults.city = s.city;
    defaults.region = s.region;
    defaults.postal = s.postal;
  }
  return defaults;
}

export default async function CheckoutPage() {
  const cart = await getCart();
  if (!cart.cartId || cart.lines.length === 0) redirect("/cart");

  const defaults = await checkoutDefaults();

  return (
    <div className="py-6">
      <CheckoutForm
        cartId={cart.cartId}
        lines={cart.lines}
        subtotalCents={cart.subtotalCents}
        comboDiscountCents={cart.comboDiscountCents}
        totalCents={cart.totalCents}
        conektaPublicKey={process.env.NEXT_PUBLIC_CONEKTA_PUBLIC_KEY ?? ""}
        defaults={defaults}
        googleAuth={process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1"}
      />
    </div>
  );
}
