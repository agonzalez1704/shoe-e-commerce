import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { commissionCents, mxWeekStart } from "@/lib/commission";
import { CommissionPayButton } from "@/components/admin/CommissionPayButton";

export const dynamic = "force-dynamic";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  dev_commission_paid_at: string | null;
  order_items: { quantity: number }[];
};

export default async function ComisionesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, created_at, dev_commission_paid_at, order_items(quantity)")
    .in("status", ["paid", "fulfilled"])
    .order("created_at", { ascending: true });

  const orders = (data ?? []) as OrderRow[];

  // group by MX week (Mon–Sun)
  const weeks = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const wk = mxWeekStart(o.created_at);
    (weeks.get(wk) ?? weeks.set(wk, []).get(wk)!).push(o);
  }

  // compute per-week cumulative tier + per-order commission
  const computed = [...weeks.entries()]
    .sort((a, b) => b[0].localeCompare(a[0])) // newest week first
    .map(([weekStart, os]) => {
      let cum = 0;
      let total = 0;
      let pending = 0;
      const unpaidIds: string[] = [];
      const rows = os.map((o) => {
        const pairs = o.order_items.reduce((n, i) => n + i.quantity, 0);
        const cents = commissionCents(cum, pairs);
        cum += pairs;
        total += cents;
        const isPaid = !!o.dev_commission_paid_at;
        if (!isPaid) { pending += cents; unpaidIds.push(o.id); }
        return { ...o, pairs, cents, isPaid };
      });
      const end = new Date(weekStart + "T12:00:00");
      end.setDate(end.getDate() + 6);
      return {
        weekStart,
        range: `${fmtDate(weekStart + "T12:00:00")} – ${fmtDate(end.toISOString())}`,
        pairs: cum,
        total,
        pending,
        unpaidIds,
        rows,
      };
    });

  const grandPending = computed.reduce((n, w) => n + w.pending, 0);

  return (
    <div className="py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comisiones del desarrollador</h1>
          <p className="mt-1 text-sm text-muted">
            $50 por par, $100 por par a partir del par 100 de la semana (corte Lun–Dom). Solo pedidos pagados.
          </p>
        </div>
        <div className="rounded-2xl border border-accent/30 bg-accent-soft px-5 py-3 text-right">
          <p className="text-xs uppercase tracking-wide text-muted">Pendiente por pagar</p>
          <p className="nums text-2xl font-semibold text-accent">{mxn(grandPending)}</p>
        </div>
      </div>

      {computed.length === 0 && <p className="text-sm text-muted">Aún no hay pedidos pagados.</p>}

      <div className="space-y-6">
        {computed.map((w) => (
          <section key={w.weekStart} className="overflow-hidden rounded-2xl border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-elevated px-4 py-3">
              <div>
                <p className="font-medium">Semana {w.range}</p>
                <p className="text-xs text-muted">
                  {w.pairs} {w.pairs === 1 ? "par" : "pares"} · comisión {mxn(w.total)} ·{" "}
                  <span className={w.pending > 0 ? "text-accent" : "text-muted"}>
                    {w.pending > 0 ? `${mxn(w.pending)} pendiente` : "pagada"}
                  </span>
                </p>
              </div>
              {w.unpaidIds.length > 0 && (
                <CommissionPayButton
                  orderIds={w.unpaidIds}
                  paid
                  label={`Marcar semana pagada (${mxn(w.pending)})`}
                  className="bg-accent text-accent-contrast"
                />
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2">Pedido</th>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2 text-right">Pares</th>
                  <th className="px-4 py-2 text-right">Comisión</th>
                  <th className="px-4 py-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {w.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nums px-4 py-2 font-medium">{r.order_number}</td>
                    <td className="px-4 py-2 text-muted">{fmtDate(r.created_at)}</td>
                    <td className="nums px-4 py-2 text-right">{r.pairs}</td>
                    <td className="nums px-4 py-2 text-right">{mxn(r.cents)}</td>
                    <td className="px-4 py-2 text-right">
                      <CommissionPayButton
                        orderIds={[r.id]}
                        paid={!r.isPaid}
                        label={r.isPaid ? "✓ Pagada" : "Pendiente"}
                        className={r.isPaid ? "bg-green-500/10 text-green-600 dark:text-green-400" : "border border-border text-muted"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
