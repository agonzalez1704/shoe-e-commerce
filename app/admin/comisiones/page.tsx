import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  paid_at: string | null;
  dev_commission_paid_at: string | null;
  dev_commission_marked_at: string | null;
  dev_commission_marked_by: string | null;
  order_items: { quantity: number }[];
};

export default async function ComisionesPage() {
  const supabase = await createClient();
  const [{ data }, { data: isDev }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, created_at, paid_at, dev_commission_paid_at, dev_commission_marked_at, dev_commission_marked_by, order_items(quantity)",
      )
      .in("status", ["paid", "fulfilled"]),
    supabase.rpc("is_dev"),
  ]);

  // the commission week follows the payment date — that's when the sale counted
  const orders = ((data ?? []) as OrderRow[])
    .map((o) => ({ ...o, soldAt: o.paid_at ?? o.created_at }))
    .sort((a, b) => a.soldAt.localeCompare(b.soldAt));

  // who marked each payout (trust between the two admins)
  const markerIds = [...new Set(orders.map((o) => o.dev_commission_marked_by).filter(Boolean))] as string[];
  const markerEmail = new Map<string, string>();
  if (markerIds.length) {
    const { data: people } = await createAdminClient().from("customers").select("id, email").in("id", markerIds);
    for (const p of people ?? []) markerEmail.set(p.id, p.email);
  }

  const weeks = new Map<string, typeof orders>();
  for (const o of orders) {
    const wk = mxWeekStart(o.soldAt);
    (weeks.get(wk) ?? weeks.set(wk, []).get(wk)!).push(o);
  }

  const computed = [...weeks.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([weekStart, os]) => {
      let cum = 0;
      let total = 0;
      let owed = 0;
      const unmarkedIds: string[] = [];
      const toConfirmIds: string[] = [];
      const rows = os.map((o) => {
        const pairs = o.order_items.reduce((n, i) => n + i.quantity, 0);
        const cents = commissionCents(cum, pairs);
        cum += pairs;
        total += cents;
        const confirmed = !!o.dev_commission_paid_at;
        const marked = !!o.dev_commission_marked_at;
        if (!confirmed) owed += cents;
        if (!marked && !confirmed) unmarkedIds.push(o.id);
        if (marked && !confirmed) toConfirmIds.push(o.id);
        return { ...o, pairs, cents, confirmed, marked };
      });
      const end = new Date(weekStart + "T12:00:00");
      end.setDate(end.getDate() + 6);
      return {
        weekStart,
        range: `${fmtDate(weekStart + "T12:00:00")} – ${fmtDate(end.toISOString())}`,
        pairs: cum,
        total,
        owed,
        unmarkedIds,
        toConfirmIds,
        rows,
      };
    });

  const grandOwed = computed.reduce((n, w) => n + w.owed, 0);

  return (
    <div className="py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comisiones del desarrollador</h1>
          <p className="mt-1 text-sm text-muted">
            $50 por par, $100 por par a partir del par 100 de la semana. Corte Lun–Dom por{" "}
            <span className="font-medium text-text">fecha de pago</span>.
          </p>
          <p className="mt-1 text-xs text-muted">
            {isDev
              ? "Puedes marcar un pago como recibido, o confirmar los que ya marcó el otro admin."
              : "Marca lo que ya pagaste; el desarrollador confirma cuando lo recibe."}
          </p>
        </div>
        <div className="rounded-2xl border border-accent/30 bg-accent-soft px-5 py-3 text-right">
          <p className="text-xs uppercase tracking-wide text-muted">Sin confirmar</p>
          <p className="nums text-2xl font-semibold text-accent">{mxn(grandOwed)}</p>
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
                  <span className={w.owed > 0 ? "text-accent" : "text-muted"}>
                    {w.owed > 0 ? `${mxn(w.owed)} sin confirmar` : "confirmada"}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <CommissionPayButton
                  orderIds={w.unmarkedIds}
                  kind="mark"
                  label={isDev ? "Marcar semana pagada" : "Ya pagué esta semana"}
                  className="bg-accent text-accent-contrast"
                />
                {isDev && (
                  <CommissionPayButton
                    orderIds={w.toConfirmIds}
                    kind="confirm"
                    label="Confirmar semana"
                    className="bg-green-600 text-white"
                  />
                )}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2">Pedido</th>
                  <th className="px-4 py-2">Pagado el</th>
                  <th className="px-4 py-2 text-right">Pares</th>
                  <th className="px-4 py-2 text-right">Comisión</th>
                  <th className="px-4 py-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {w.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nums px-4 py-2 font-medium">{r.order_number}</td>
                    <td className="px-4 py-2 text-muted">{fmtDate(r.soldAt)}</td>
                    <td className="nums px-4 py-2 text-right">{r.pairs}</td>
                    <td className="nums px-4 py-2 text-right">{mxn(r.cents)}</td>
                    <td className="px-4 py-2 text-right">
                      {r.confirmed ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                            ✓ Confirmada
                          </span>
                          {isDev && <CommissionPayButton orderIds={[r.id]} kind="reset" label="Revertir" className="text-muted hover:text-text" />}
                        </span>
                      ) : r.marked ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                            title={
                              r.dev_commission_marked_by
                                ? `Marcada por ${markerEmail.get(r.dev_commission_marked_by) ?? "otro admin"}`
                                : undefined
                            }
                          >
                            Por confirmar
                          </span>
                          {isDev && (
                            <CommissionPayButton orderIds={[r.id]} kind="confirm" label="Confirmar" className="bg-green-600 text-white" />
                          )}
                        </span>
                      ) : (
                        <CommissionPayButton
                          orderIds={[r.id]}
                          kind="mark"
                          label={isDev ? "Marcar pagada" : "Ya pagué"}
                          className="border border-border text-muted"
                        />
                      )}
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
