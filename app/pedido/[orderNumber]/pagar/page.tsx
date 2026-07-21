import Link from "next/link";
import { redirect } from "next/navigation";
import { Storefront, Bank, Clock } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConektaOrder } from "@/lib/conekta";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const CHAINS = "7-Eleven, Walmart, Bodega Aurrerá, Circle K, Sam's Club, Farmacias del Ahorro, Soriana y +20,000 tiendas";

// Resume an unfinished payment. Cash/SPEI just need their voucher shown again;
// Aplazo hands off to the provider, whose approval URL expires and gets
// reissued — so ask Conekta for the current one instead of storing it.
export default async function PagarPedido({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  // ownership first: RLS only returns the order to the customer who owns it
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, total_cents, payment_method")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order) redirect("/cuenta");
  if (order.status !== "pending") redirect(`/rastrear?o=${encodeURIComponent(orderNumber)}`);

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("provider_charge_id, method, reference, clabe, voucher_url, expires_at")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // provider-hosted approval (Aplazo / card 3DS): bounce straight there
  if (payment?.provider_charge_id && (order.payment_method === "aplazo" || order.payment_method === "card")) {
    let url: string | undefined;
    try {
      const co = await getConektaOrder(payment.provider_charge_id);
      const pm = co.charges?.data?.[0]?.payment_method;
      url = co.next_action?.redirect_to_url?.url ?? pm?.redirect_url;
    } catch (e) {
      console.error("[pagar] could not fetch the provider order:", e);
    }
    if (url) redirect(url);
  }

  const expires = payment?.expires_at ? new Date(payment.expires_at).toLocaleString("es-MX") : null;

  return (
    <div className="mx-auto max-w-md py-12">
      <p className="text-sm text-muted">Pedido <span className="nums font-medium text-text">{orderNumber}</span></p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Completa tu pago</h1>
      <p className="nums mt-2 text-3xl font-semibold">{mxn(order.total_cents)}</p>

      {expires && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
          <Clock size={15} /> Vence el {expires}
        </p>
      )}

      {payment?.reference && (
        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Storefront size={17} weight="fill" className="text-accent" /> Paga en efectivo
          </p>
          <div className="rounded-xl bg-white p-4 text-center">
            {payment.voucher_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={payment.voucher_url} alt="Código de barras para pago en efectivo" className="mx-auto max-h-44 w-auto" />
            )}
            <p className="mt-2 break-all font-mono text-sm tracking-wider text-zinc-900">{payment.reference}</p>
          </div>
          <p className="text-xs text-muted">
            Muestra este código en la caja de {CHAINS}. <span className="font-medium">No disponible en OXXO.</span>
          </p>
        </div>
      )}

      {payment?.clabe && (
        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Bank size={17} weight="fill" className="text-accent" /> Transferencia SPEI
          </p>
          <div className="rounded-xl bg-elevated p-4">
            <p className="text-xs text-muted">CLABE</p>
            <p className="nums break-all font-mono text-lg">{payment.clabe}</p>
          </div>
          <p className="text-xs text-muted">Transfiere el monto exacto desde tu banca en línea.</p>
        </div>
      )}

      {!payment?.reference && !payment?.clabe && (
        <p className="mt-6 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
          No pudimos recuperar las instrucciones de pago de este pedido. Escríbenos a{" "}
          <a href="mailto:pedidos@calzadoblade.com" className="text-accent underline">pedidos@calzadoblade.com</a> y te ayudamos.
        </p>
      )}

      <p className="mt-6 text-xs text-muted">
        Te enviaremos un correo en cuanto se acredite. Tu calzado se fabrica sobre pedido y se envía en 4 a 7 días hábiles.
      </p>

      <div className="mt-8 flex gap-3">
        <Link href="/cuenta" className="rounded-full border border-border px-5 py-2.5 text-sm font-medium">Mis pedidos</Link>
        <Link href="/products" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast">Seguir comprando</Link>
      </div>
    </div>
  );
}
