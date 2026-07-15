import Link from "next/link";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

// 3DS return target. Generic on purpose (no DB read = no order info leak);
// the real confirmation arrives by email once the webhook confirms payment.
export default async function GraciasPage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;

  return (
    <div className="flex flex-col items-center py-16 text-center">
      {o ? (
        <>
          <OrderConfirmation orderNumber={o} trackUrl={`${SITE_URL}/rastrear`} />
          <p className="mt-8 max-w-md text-sm text-muted">
            Estamos confirmando tu pago. Te enviaremos un correo en cuanto se acredite. Tu calzado se fabrica
            sobre pedido y se envía en 4 a 7 días hábiles.
          </p>
        </>
      ) : (
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">¡Gracias por tu compra!</h1>
          <p className="mt-4 text-sm text-muted">
            Estamos confirmando tu pago. Te enviaremos un correo en cuanto se acredite. Tu calzado se fabrica
            sobre pedido y se envía en 4 a 7 días hábiles.
          </p>
        </div>
      )}

      <Link
        href="/products"
        className="mt-8 inline-block rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast"
      >
        Seguir comprando
      </Link>
    </div>
  );
}
