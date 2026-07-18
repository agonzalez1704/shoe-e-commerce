import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderStatusActions } from "@/components/OrderStatusActions";
import { CfdiActions } from "@/components/CfdiActions";
import { FulfillmentPanel } from "@/components/admin/FulfillmentPanel";

export const dynamic = "force-dynamic";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

type Status = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status, email, subtotal_cents, discount_cents, tax_cents, shipping_cents, total_cents, payment_method, needs_invoice, created_at, shipping_address, fulfillment_stage, carrier, tracking_number, tracking_url, estimated_delivery, shipped_at, delivered_at, shipping_label_url")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: payment }, { data: fiscal }, { data: cfdi }] = await Promise.all([
    supabase.from("order_items").select("product_name, variant_label, sku, unit_price_cents, quantity, line_total_cents").eq("order_id", id),
    supabase.from("payments").select("method, status, reference, clabe, voucher_url, expires_at").eq("order_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("order_fiscal_data").select("rfc, fiscal_name, fiscal_regime, cfdi_use, postal_code").eq("order_id", id).maybeSingle(),
    supabase.from("cfdi_documents").select("status, uuid_fiscal, xml_url, pdf_url, pac_error").eq("order_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <CaretLeft size={14} /> Pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="nums text-2xl font-semibold tracking-tight">{order.order_number}</h1>
          <StatusBadge status={order.status} />
        </div>
        <OrderStatusActions orderId={order.id} status={order.status as Status} />
      </div>

      <FulfillmentPanel
        order={{
          id: order.id,
          paymentStatus: order.status,
          fulfillment_stage: order.fulfillment_stage,
          carrier: order.carrier,
          tracking_number: order.tracking_number,
          tracking_url: order.tracking_url,
          estimated_delivery: order.estimated_delivery,
          shipped_at: order.shipped_at,
          delivered_at: order.delivered_at,
          shipping_label_url: order.shipping_label_url,
        }}
      />

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Artículo</th><th className="px-4 py-3 text-right">Cant.</th><th className="px-4 py-3 text-right">Importe</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(items ?? []).map((it, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{it.product_name}</p>
                    <p className="text-xs capitalize text-muted">{it.variant_label} · <span className="nums">{it.sku}</span></p>
                  </td>
                  <td className="nums px-4 py-3 text-right">{it.quantity}</td>
                  <td className="nums px-4 py-3 text-right">{mxn(it.line_total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Totales</h2>
            <Row label="Subtotal" value={mxn(order.subtotal_cents)} />
            {order.discount_cents > 0 && <Row label="Descuento" value={`- ${mxn(order.discount_cents)}`} />}
            <Row label="Envío" value={mxn(order.shipping_cents)} />
            <Row label="IVA (incl.)" value={mxn(order.tax_cents)} muted />
            <div className="mt-2 border-t border-border pt-2">
              <Row label="Total" value={mxn(order.total_cents)} bold />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Pago</h2>
            <p className="uppercase">{payment?.method ?? order.payment_method ?? "—"} · <span className="text-muted">{payment?.status ?? "—"}</span></p>
            {payment?.reference && <p className="nums mt-1 text-muted">Ref: {payment.reference}</p>}
            {payment?.clabe && <p className="nums mt-1 text-muted">CLABE: {payment.clabe}</p>}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Cliente</h2>
            <p className="text-muted">{order.email}</p>
          </div>

          {order.needs_invoice && (
            <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4 text-sm">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-accent">Factura (CFDI)</h2>
              {fiscal ? (
                <div className="space-y-0.5 text-muted">
                  <p className="nums">{fiscal.rfc}</p>
                  <p>{fiscal.fiscal_name}</p>
                  <p>{fiscal.fiscal_regime} · {fiscal.cfdi_use} · CP {fiscal.postal_code}</p>
                </div>
              ) : (
                <p className="text-muted">Solicitada, sin datos.</p>
              )}
              <div className="mt-3 border-t border-accent/20 pt-3">
                <CfdiActions orderId={order.id} doc={cfdi} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className={muted ? "text-muted" : ""}>{label}</span>
      <span className={`nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
