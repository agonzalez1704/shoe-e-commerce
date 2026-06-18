import { getCart } from "./actions";
import { CartView } from "@/components/CartView";

export const dynamic = "force-dynamic"; // cart is per-session

export default async function CartPage() {
  const cart = await getCart();
  return (
    <div className="py-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Carrito</h1>
      <CartView initial={cart} />
    </div>
  );
}
