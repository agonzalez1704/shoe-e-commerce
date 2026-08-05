import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { StageBadge } from "@/components/StageBadge";
import { requirePagePermiso } from "@/lib/permisos-guard";

export const dynamic = "force-dynamic";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const shortDate = (s: string) => new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
const STATUSES = ["all", "pending", "paid", "fulfilled", "cancelled", "refunded"] as const;
type Status = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

const PER_PAGE = 25;

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requirePagePermiso("pedidos_ver");
  const { status, q, page } = await searchParams;
  const active = status ?? "all";
  // strip chars that would break the PostgREST .or() filter syntax
  const query = (q ?? "").trim().replace(/[,()%*\\]/g, "").slice(0, 60);
  const current = Math.max(1, Number(page) || 1);
  const from = (current - 1) * PER_PAGE;
  const supabase = await createClient();

  let sb = supabase
    .from("orders")
    .select(
      "id, order_number, status, fulfillment_stage, total_cents, payment_method, email, created_at, shipping_address",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  if (active !== "all") sb = sb.eq("status", active as Status);
  // search the buyer's name too — it lives in the shipping address, and looking
  // someone up by name is the usual way a customer message arrives
  if (query) {
    sb = sb.or(
      `order_number.ilike.%${query}%,email.ilike.%${query}%,shipping_address->>name.ilike.%${query}%`,
    );
  }
  const { data: orders, count } = await sb;

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    if (active !== "all") sp.set("status", active);
    if (query) sp.set("q", query);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Pedidos</h1>
        <form className="relative">
          {active !== "all" && <input type="hidden" name="status" value={active} />}
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar por #, correo o nombre…"
            className="w-56 rounded-full border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </form>
      </div>

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

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Entrega</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="transition-colors hover:bg-elevated">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="nums font-medium hover:text-accent">{o.order_number}</Link>
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate">{(o.shipping_address as { name?: string } | null)?.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted">{o.email}</p>
                </td>
                <td className="nums px-4 py-3 text-muted">{shortDate(o.created_at)}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3"><StageBadge stage={o.fulfillment_stage} /></td>
                <td className="nums px-4 py-3 text-right">{mxn(o.total_cents)}</td>
              </tr>
            ))}
            {(orders ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Sin pedidos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            {from + 1}–{Math.min(from + PER_PAGE, total)} de <span className="nums font-medium text-text">{total}</span>{" "}
            {total === 1 ? "pedido" : "pedidos"}
          </p>
          <div className="flex items-center gap-2">
            {current > 1 ? (
              <Link href={hrefFor(current - 1)} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-text">
                ← Anterior
              </Link>
            ) : (
              <span className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted/40">← Anterior</span>
            )}
            <span className="text-xs text-muted">Página {current} de {lastPage}</span>
            {current < lastPage ? (
              <Link href={hrefFor(current + 1)} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-text">
                Siguiente →
              </Link>
            ) : (
              <span className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted/40">Siguiente →</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
