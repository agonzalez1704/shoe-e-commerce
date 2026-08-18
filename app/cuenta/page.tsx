import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { customerSignOut } from "@/app/cuenta/actions";
import { AuthForms } from "@/components/AuthForms";
import { StatusBadge } from "@/components/StatusBadge";
import { PASOS_CLIENTE, pasoCliente, carrierName, trackingUrlFor, fechaEntrega } from "@/lib/fulfillment";
import { formatCents } from "@/lib/money";
import { activeBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const ITEMS_ORDERED = `${activeBrand.copy?.itemPlural ?? "Productos"} pedidos`.replace(/^./, (c) => c.toUpperCase());

export default async function CuentaPage({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string; next?: string }> }) {
  const { error, msg, next } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-12">
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <AuthForms error={error} msg={msg} google={process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1"} next={next ?? "/cuenta"} />
      </div>
    );
  }

  const [{ data: customer }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select("order_number, status, fulfillment_stage, carrier, tracking_number, tracking_url, estimated_delivery, total_cents, created_at, payment_method, shipping_address, order_items(product_name, variant_label, quantity)").eq("customer_id", user.id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {customer?.full_name ?? "bienvenido"}</h1>
          <p className="text-sm text-muted">{customer?.email ?? user.email}</p>
        </div>
        <form action={customerSignOut}>
          <button className="rounded-full border border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text">Salir</button>
        </form>
      </div>

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Mis pedidos</h2>
      {(orders ?? []).length === 0 ? (
        <p className="text-sm text-muted">Aún no tienes pedidos. <Link href="/products" className="text-accent underline">Ir a la tienda</Link></p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {(orders ?? []).map((o) => {
            const items = (o.order_items ?? []) as { product_name: string; variant_label: string; quantity: number }[];
            const ship = (o.shipping_address ?? {}) as Record<string, string>;
            const addr = [ship.line1, ship.neighborhood, ship.city, ship.region, ship.postal].filter(Boolean).join(", ");
            const rastreoUrl = trackingUrlFor(o.carrier, o.tracking_number, o.tracking_url);
            return (
              <li key={o.order_number} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="nums font-medium">{o.order_number}</span>
                  <StatusBadge status={o.status} />
                  {/* El estado de pago no dice dónde va el pedido: se añade la
                      etapa real, combinada con el estado igual que en /rastrear. */}
                  {o.status !== "cancelled" && o.status !== "refunded" && (
                    <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs font-medium text-text">
                      {PASOS_CLIENTE[pasoCliente(o.status, o.fulfillment_stage)].label}
                    </span>
                  )}
                  <span className="text-muted">{new Date(o.created_at).toLocaleDateString("es-MX")}</span>
                  <span className="nums ml-auto">{mxn(o.total_cents)}</span>
                  {o.status === "pending" ? (
                    <Link
                      href={`/pedido/${o.order_number}/pagar`}
                      className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-contrast"
                    >
                      {o.payment_method === "aplazo" ? "Continuar en Aplazo" : "Completar pago"} →
                    </Link>
                  ) : (
                    <Link
                      href={`/rastrear?o=${o.order_number}`}
                      className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-text"
                    >
                      Rastrear
                    </Link>
                  )}
                </div>
                <details className="mt-2 [&_summary]:cursor-pointer">
                  <summary className="text-xs font-medium text-accent">Ver detalle</summary>
                  <div className="mt-2 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">{ITEMS_ORDERED}</p>
                      <ul className="mt-1.5 space-y-0.5 text-muted">
                        {items.map((it, i) => (
                          <li key={i} className="capitalize">{it.product_name} ({it.variant_label}) × {it.quantity}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      {/* La guía también aquí: el comprador que entra a su
                          cuenta no debería tener que ir a /rastrear a buscarla. */}
                      {(o.tracking_number || o.estimated_delivery) && (
                        <div className="mb-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted">Rastreo</p>
                          <div className="mt-1.5 text-muted">
                            {o.tracking_number && (
                              <p>
                                {carrierName(o.carrier) ?? "Paquetería"}{" "}
                                <span className="nums text-text">{o.tracking_number}</span>
                              </p>
                            )}
                            {o.estimated_delivery && (
                              <p>
                                Entrega estimada:{" "}
                                <span className="text-text">
                                  {fechaEntrega(o.estimated_delivery)}
                                </span>
                              </p>
                            )}
                            {rastreoUrl && (
                              <a href={rastreoUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block font-medium text-accent underline">
                                Rastrear con la paquetería →
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Datos de envío</p>
                      <div className="mt-1.5 text-muted">
                        {ship.name && <p className="text-text">{ship.name}</p>}
                        {ship.phone && <p className="nums">{ship.phone}</p>}
                        {addr && <p className="leading-relaxed">{addr}</p>}
                        {!ship.name && !addr && <p>Sin datos de envío.</p>}
                      </div>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
