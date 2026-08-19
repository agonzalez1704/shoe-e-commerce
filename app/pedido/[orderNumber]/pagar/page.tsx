import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Storefront, Bank, Clock } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConektaOrder } from "@/lib/conekta";
import { createMpPreference } from "@/lib/mercadopago";
import { formatCents } from "@/lib/money";
import { CASH_CHAINS } from "@/lib/payment-method";
import { SITE_URL } from "@/lib/site";
import { activeBrand } from "@/lib/brand";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;


const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const CHAINS = "7-Eleven, Walmart, Bodega Aurrerá, Circle K, Sam's Club, Farmacias del Ahorro, Soriana y +20,000 tiendas";

// Resume an unfinished payment. Cash/SPEI just need their voucher shown again;
// Aplazo hands off to the provider, whose approval URL expires and gets
// reissued — so ask Conekta for the current one instead of storing it.
export default async function PagarPedido({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  // ownership first: RLS only returns the order to the customer who owns it.
  // Guests have no customer_id, so fall back to the cart session token stamped
  // on the order — without it a guest could never resume their own payment.
  const supabase = await createClient();
  let { data: order } = await supabase
    .from("orders")
    .select("id, status, total_cents, payment_method")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) {
    const token = (await cookies()).get("cart_token")?.value;
    if (token) {
      const { data: guestOrder } = await createAdminClient()
        .from("orders")
        .select("id, status, total_cents, payment_method")
        .eq("order_number", orderNumber)
        .eq("session_token", token)
        .maybeSingle();
      order = guestOrder;
    }
  }
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

  // MercadoPago: no stored voucher — mint a fresh Checkout Pro preference for the
  // still-pending order and bounce back to MP so the buyer can finish paying.
  if (order.payment_method === "mercadopago") {
    let url: string | undefined;
    try {
      const { data: full } = await admin
        .from("orders").select("email, shipping_address").eq("id", order.id).maybeSingle();
      const { data: items } = await admin
        .from("order_items").select("quantity").eq("order_id", order.id);
      const itemCount = (items ?? []).reduce((n, i) => n + i.quantity, 0);
      const ship = (full?.shipping_address ?? null) as { name?: string } | null;
      const pref = await createMpPreference({
        orderNumber,
        amountCents: order.total_cents,
        itemsSummary: `${itemCount} ${itemCount === 1 ? "artículo" : "artículos"}`,
        customer: { name: ship?.name ?? "", email: full?.email ?? "" },
        successUrl: `${SITE_URL}/checkout/gracias?o=${orderNumber}`,
        failureUrl: `${SITE_URL}/checkout/gracias?o=${orderNumber}&payment_status=failed`,
        notificationUrl: `${SITE_URL}/api/webhooks/mercadopago?secret=${process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ""}`,
      });
      url = pref.init_point || pref.sandbox_init_point;
    } catch (e) {
      console.error("[pagar] could not create MercadoPago preference:", e);
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
          <details className="text-sm [&_summary]:cursor-pointer">
            <summary className="font-medium text-accent">Ver todas las tiendas</summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CASH_CHAINS.map((c) => (
                <span key={c} className="rounded-md bg-elevated px-2 py-1 text-[11px] text-muted ring-1 ring-border">{c}</span>
              ))}
            </div>
          </details>
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
          <a href={`mailto:${activeBrand.legal.supportEmail}`} className="text-accent underline">{activeBrand.legal.supportEmail}</a> y te ayudamos.
        </p>
      )}

      <p className="mt-6 text-xs text-muted">
        Te enviaremos un correo en cuanto se acredite. {activeBrand.copy?.madeToOrderLine}
      </p>

      <div className="mt-8 flex gap-3">
        <Link href="/cuenta" className="rounded-full border border-border px-5 py-2.5 text-sm font-medium">Mis pedidos</Link>
        <Link href="/products" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast">Seguir comprando</Link>
      </div>
    </div>
  );
}
