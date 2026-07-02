import { redirect } from "next/navigation";
import { getCart } from "@/app/cart/actions";
import { CheckoutForm } from "@/components/CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cart = await getCart();
  if (!cart.cartId || cart.lines.length === 0) redirect("/cart");

  return (
    <div className="py-6">
      <CheckoutForm
        cartId={cart.cartId}
        lines={cart.lines}
        subtotalCents={cart.subtotalCents}
        conektaPublicKey={process.env.NEXT_PUBLIC_CONEKTA_PUBLIC_KEY ?? ""}
      />
    </div>
  );
}
