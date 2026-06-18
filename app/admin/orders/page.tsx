import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const STATUSES = ["all", "pending", "paid", "fulfilled", "cancelled", "refunded"] as const;

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = status ?? "all";
  const supabase = await createClient();

  let q = supabase
    .from("orders")
    .select("id, order_number, status, total_cents, payment_method, email, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (active !== "all") q = q.eq("status", active as "pending" | "paid" | "fulfilled" | "cancelled" | "refunded");
  const { data: orders } = await q;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Pedidos</h1>
        <div className="flex flex-wrap gap-1 rounded-full border border-border p-1">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={s === "all" ? "/admin/orders" : `/admin/orders?status=${s}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                active === s ? "bg-text text-bg" : "text-muted hover:text-text"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="transition-colors hover:bg-elevated">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="nums font-medium hover:text-accent">{o.order_number}</Link>
                </td>
                <td className="px-4 py-3 text-muted">{o.email}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 uppercase text-muted">{o.payment_method ?? "—"}</td>
                <td className="nums px-4 py-3 text-right">{mxn(o.total_cents)}</td>
              </tr>
            ))}
            {(orders ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Sin pedidos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
