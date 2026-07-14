import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

// 3DS return target. Generic on purpose (no DB read = no order info leak);
// the real confirmation arrives by email once the webhook confirms payment.
export default async function GraciasPage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <CheckCircle size={40} weight="fill" className="mx-auto text-accent" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">¡Gracias por tu compra!</h1>
      {o && <p className="nums mt-2 text-sm text-muted">Pedido {o}</p>}
      <p className="mt-4 text-sm text-muted">
        Estamos confirmando tu pago. Te enviaremos un correo en cuanto se acredite. Tu calzado se fabrica sobre pedido
        y se envía en 4 a 7 días hábiles.
      </p>
      <Link href="/products" className="mt-8 inline-block rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast">
        Seguir comprando
      </Link>
    </div>
  );
}
