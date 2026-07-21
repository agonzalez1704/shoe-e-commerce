import Link from "next/link";
import { Package, Storefront, Truck, Clock } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { StageBadge } from "@/components/StageBadge";
import { PushToggle } from "@/components/admin/PushToggle";

export const dynamic = "force-dynamic";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const shortDate = (s: string) => new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

export default async function AdminHome() {
  const supabase = await createClient();

  const [pendingPay, inProduction, ready, inTransit, recent, toShip] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("fulfillment_stage", "in_production"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("fulfillment_stage", "ready"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("fulfillment_stage", "shipped"),
    supabase.from("orders").select("id, order_number, status, fulfillment_stage, total_cents, payment_method, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("orders").select("id, order_number, email, total_cents, fulfillment_stage, estimated_delivery, created_at").in("fulfillment_stage", ["in_production", "ready"]).order("created_at", { ascending: true }).limit(8),
  ]);

  const stats = [
    { label: "Pendientes de pago", value: pendingPay.count ?? 0, href: "/admin/orders?status=pending", Icon: Clock },
    { label: "En producción", value: inProduction.count ?? 0, href: "/admin/orders", Icon: Package },
    { label: "Listos para envío", value: ready.count ?? 0, href: "/admin/orders", Icon: Storefront },
    { label: "En tránsito", value: inTransit.count ?? 0, href: "/admin/orders", Icon: Truck },
  ];

  return (
    <div className="space-y-10">
      <PushToggle />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, href, Icon }) => (
          <Link key={label} href={href} className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-text">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{label}</p>
              <Icon size={18} className="text-accent" />
            </div>
            <p className="nums mt-2 text-3xl font-semibold">{value}</p>
          </Link>
        ))}
      </section>

      {/* fulfillment queue */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Por preparar y enviar</h2>
          <Link href="/admin/orders" className="text-xs text-accent hover:underline">Ver todos</Link>
        </div>
        {(toShip.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">Nada pendiente por enviar. 🎉</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3">Entrega est.</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(toShip.data ?? []).map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-elevated">
                    <td className="px-4 py-3"><Link href={`/admin/orders/${o.id}`} className="nums font-medium hover:text-accent">{o.order_number}</Link></td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-muted">{o.email}</td>
                    <td className="px-4 py-3"><StageBadge stage={o.fulfillment_stage} /></td>
                    <td className="nums px-4 py-3 text-muted">{o.estimated_delivery ?? "—"}</td>
                    <td className="nums px-4 py-3 text-right">{mxn(o.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* recent */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Pedidos recientes</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Pago</th>
                <th className="px-4 py-3">Entrega</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recent.data ?? []).map((o) => (
                <tr key={o.id} className="transition-colors hover:bg-elevated">
                  <td className="px-4 py-3"><Link href={`/admin/orders/${o.id}`} className="nums font-medium hover:text-accent">{o.order_number}</Link></td>
                  <td className="nums px-4 py-3 text-muted">{shortDate(o.created_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3"><StageBadge stage={o.fulfillment_stage} /></td>
                  <td className="nums px-4 py-3 text-right">{mxn(o.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
