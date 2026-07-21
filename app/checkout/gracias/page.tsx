import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { o?: string; order_id?: string; payment_status?: string };

// Provider return target (card 3DS / Aplazo). Never claim the order is paid on
// the provider's say-so: confirm against our own record first. Order numbers are
// sequential and guessable, so the lookup is keyed on the provider's order id
// (unguessable) — holding it proves the visitor came through the flow.
async function resolveState({ o, order_id, payment_status }: Params): Promise<"paid" | "pending" | "failed"> {
  if (o && order_id) {
    const admin = createAdminClient();
    const { data: payment } = await admin
      .from("payments")
      .select("order_id, orders(order_number, status)")
      .eq("provider_charge_id", order_id)
      .maybeSingle();
    const order = payment?.orders as unknown as { order_number: string; status: string } | null | undefined;
    if (order?.order_number === o) {
      if (order.status === "paid" || order.status === "fulfilled") return "paid";
      if (order.status === "cancelled") return "failed";
    }
  }
  // not confirmed on our side yet — the provider's hint is all we have
  return /error|declined|failed|denied/i.test(payment_status ?? "") ? "failed" : "pending";
}

export default async function GraciasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { o } = params;
  const state = await resolveState(params);

  if (state === "failed") {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="max-w-md">
          <WarningCircle size={40} weight="fill" className="mx-auto text-accent" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">No pudimos procesar tu pago</h1>
          <p className="mt-4 text-sm text-muted">
            Tu pedido {o && <span className="nums font-medium text-text">{o}</span>} no se cobró. Si ves un
            movimiento en tu tarjeta es una retención temporal que tu banco libera.
          </p>
          <p className="mt-3 text-sm text-muted">
            Intenta de nuevo con otra tarjeta, o paga en OXXO o por transferencia.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/checkout" className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast">
            Intentar de nuevo
          </Link>
          <Link href="/products" className="rounded-full border border-border px-6 py-3 text-sm font-medium">
            Seguir comprando
          </Link>
        </div>
      </div>
    );
  }

  const paid = state === "paid";

  return (
    <div className="flex flex-col items-center py-16 text-center">
      {o ? (
        <>
          <OrderConfirmation
            orderNumber={o}
            trackUrl={`${SITE_URL}/rastrear`}
            status={paid ? "Pedido confirmado" : "Pedido recibido"}
          />
          <p className="mt-8 max-w-md text-sm text-muted">
            {paid
              ? "Tu pago está confirmado. Tu calzado se fabrica sobre pedido y se envía en 4 a 7 días hábiles."
              : "Estamos confirmando tu pago. Te enviaremos un correo en cuanto se acredite — si no se completa, no se hará ningún cargo."}
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
