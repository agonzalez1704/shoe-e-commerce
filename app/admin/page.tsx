import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export default async function AdminHome() {
  const supabase = await createClient();

  const [pending, paid, lowStock, recent] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("variant_availability").select("variant_id", { count: "exact", head: true }).lte("qty_available", 3),
    supabase.from("orders").select("id, order_number, status, total_cents, payment_method, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  const stats = [
    { label: "Pedidos pendientes", value: pending.count ?? 0, href: "/admin/orders?status=pending" },
    { label: "Pedidos pagados", value: paid.count ?? 0, href: "/admin/orders?status=paid" },
    { label: "Stock bajo (≤3)", value: lowStock.count ?? 0, href: "/admin/inventory" },
  ];

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-text">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="nums mt-2 text-3xl font-semibold">{s.value}</p>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Pedidos recientes</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recent.data ?? []).map((o) => (
                <tr key={o.id} className="transition-colors hover:bg-elevated">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="nums font-medium hover:text-accent">{o.order_number}</Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 uppercase text-muted">{o.payment_method ?? "—"}</td>
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
