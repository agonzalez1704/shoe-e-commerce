import { redirect } from "next/navigation";
import { getCart } from "@/app/cart/actions";
import { CheckoutForm } from "@/components/CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cart = await getCart();
  if (!cart.cartId || cart.lines.length === 0) redirect("/cart");

  return (
    <div className="py-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Pago</h1>
      <CheckoutForm
        cartId={cart.cartId}
        subtotalCents={cart.subtotalCents}
        conektaPublicKey={process.env.NEXT_PUBLIC_CONEKTA_PUBLIC_KEY ?? ""}
      />
    </div>
  );
}
