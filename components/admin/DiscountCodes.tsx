"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash, Plus, PencilSimple, X, Check } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { createDiscountCode, updateDiscountCode, setDiscountActive, deleteDiscountCode } from "@/app/admin/actions";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export type CodeRow = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_subtotal_cents: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
};

const IN = "h-10 w-full rounded-lg border border-border bg-bg px-2.5 text-sm text-text outline-none focus:border-accent";

export function DiscountCodes({ rows }: { rows: CodeRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [type, setType] = useState<"percent" | "fixed">("percent");
  // Fila en edicion. El codigo no se edita: es la identidad que ya circula en
  // links y conversaciones; para renombrar, se crea otro y se apaga este.
  const [editing, setEditing] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setErr(null);
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      }
    });

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement)?.value ?? "";
    const value = type === "percent" ? Number(g("value")) : Math.round(Number(g("value")) * 100);
    run(async () => {
      await createDiscountCode({
        code: g("code"),
        type,
        value,
        minSubtotalCents: Math.round(Number(g("min") || 0) * 100),
        maxUses: g("maxUses") ? Number(g("maxUses")) : null,
        expiresAt: g("expires") ? new Date(g("expires")).toISOString() : null,
      });
      f.reset();
    });
  }

  return (
    <div className="space-y-5">
      {/* create */}
      <form onSubmit={onCreate} className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-6">
        <label className="text-xs text-muted sm:col-span-2">
          Código
          <input name="code" required placeholder="BIENVENIDO10" className={`${IN} mt-1 uppercase`} />
        </label>
        <label className="text-xs text-muted">
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as "percent" | "fixed")} className={`${IN} mt-1`}>
            <option value="percent">Porcentaje</option>
            <option value="fixed">Monto fijo</option>
          </select>
        </label>
        <label className="text-xs text-muted">
          {type === "percent" ? "% descuento" : "Monto (MXN)"}
          <input name="value" type="number" step={type === "percent" ? "1" : "0.01"} min="0" required className={`${IN} nums mt-1`} />
        </label>
        <label className="text-xs text-muted">
          Mínimo de compra (MXN)
          <input name="min" type="number" step="0.01" min="0" placeholder="0" className={`${IN} nums mt-1`} />
        </label>
        <label className="text-xs text-muted">
          Usos máx.
          <input name="maxUses" type="number" min="1" placeholder="∞" className={`${IN} nums mt-1`} />
        </label>
        <label className="text-xs text-muted sm:col-span-2">
          Vence (opcional)
          <input name="expires" type="date" className={`${IN} nums mt-1`} />
        </label>
        <div className="flex items-end sm:col-span-2">
          <button
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <Plus size={15} weight="bold" /> Crear código
          </button>
        </div>
      </form>

      {err && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{err}</p>}

      {/* list */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descuento</th>
              <th className="px-4 py-3">Mínimo</th>
              <th className="px-4 py-3">Usos</th>
              <th className="px-4 py-3">Vence</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              editing === r.id ? (
                <EditRow
                  key={r.id}
                  row={r}
                  disabled={isPending}
                  onCancel={() => setEditing(null)}
                  onSave={(input) => run(async () => { await updateDiscountCode(r.id, input); setEditing(null); })}
                />
              ) : (
              <tr key={r.id} className="transition-colors hover:bg-elevated">
                <td className="nums px-4 py-3 font-medium">{r.code}</td>
                <td className="px-4 py-3">{r.type === "percent" ? `${r.value}%` : mxn(r.value)}</td>
                <td className="nums px-4 py-3 text-muted">{r.min_subtotal_cents > 0 ? mxn(r.min_subtotal_cents) : "—"}</td>
                <td className="nums px-4 py-3 text-muted">
                  {r.used_count}
                  {r.max_uses != null ? ` / ${r.max_uses}` : ""}
                </td>
                <td className="nums px-4 py-3 text-muted">
                  {r.expires_at ? new Date(r.expires_at).toLocaleDateString("es-MX") : "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    disabled={isPending}
                    onClick={() => run(() => setDiscountActive(r.id, !r.active))}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      r.active ? "bg-accent text-accent-contrast" : "border border-border text-muted"
                    }`}
                  >
                    {r.active ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-3">
                    <button
                      disabled={isPending}
                      onClick={() => setEditing(r.id)}
                      aria-label={`Editar ${r.code}`}
                      className="text-muted transition-colors hover:text-accent"
                    >
                      <PencilSimple size={15} />
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => run(() => deleteDiscountCode(r.id))}
                      aria-label="Eliminar"
                      className="text-muted transition-colors hover:text-accent"
                    >
                      <Trash size={15} />
                    </button>
                  </span>
                </td>
              </tr>
              )
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">Sin códigos de descuento.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Fila editable: mismos campos que el alta menos el codigo. Estado local por
// input; centavos <-> pesos se convierten aqui, como en el alta.
function EditRow({ row, disabled, onSave, onCancel }: {
  row: CodeRow;
  disabled: boolean;
  onSave: (input: { type: "percent" | "fixed"; value: number; minSubtotalCents: number; maxUses: number | null; expiresAt: string | null }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<"percent" | "fixed">(row.type);
  const [value, setValue] = useState(String(row.type === "percent" ? row.value : row.value / 100));
  const [min, setMin] = useState(row.min_subtotal_cents ? String(row.min_subtotal_cents / 100) : "");
  const [maxUses, setMaxUses] = useState(row.max_uses != null ? String(row.max_uses) : "");
  const [expires, setExpires] = useState(row.expires_at ? row.expires_at.slice(0, 10) : "");

  return (
    <tr className="bg-elevated/60">
      <td className="nums px-4 py-3 font-medium">{row.code}</td>
      <td className="px-4 py-2">
        <span className="flex items-center gap-1.5">
          <select value={type} onChange={(e) => setType(e.target.value as "percent" | "fixed")} className={`${IN} w-24`}>
            <option value="percent">%</option>
            <option value="fixed">MXN</option>
          </select>
          <input value={value} onChange={(e) => setValue(e.target.value)} type="number" step={type === "percent" ? "1" : "0.01"} min="0" className={`${IN} nums w-20`} aria-label="Valor" />
        </span>
      </td>
      <td className="px-4 py-2">
        <input value={min} onChange={(e) => setMin(e.target.value)} type="number" step="0.01" min="0" placeholder="0" className={`${IN} nums w-24`} aria-label="Minimo de compra" />
      </td>
      <td className="px-4 py-2">
        <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} type="number" min="1" placeholder="∞" className={`${IN} nums w-16`} aria-label="Usos maximos" />
      </td>
      <td className="px-4 py-2">
        <input value={expires} onChange={(e) => setExpires(e.target.value)} type="date" className={`${IN} nums w-36`} aria-label="Vence" />
      </td>
      <td className="px-4 py-3 text-xs text-muted">{row.active ? "Activo" : "Inactivo"}</td>
      <td className="px-4 py-3 text-right">
        <span className="inline-flex items-center gap-3">
          <button
            disabled={disabled}
            onClick={() => onSave({
              type,
              value: type === "percent" ? Number(value) : Math.round(Number(value) * 100),
              minSubtotalCents: Math.round(Number(min || 0) * 100),
              maxUses: maxUses ? Number(maxUses) : null,
              expiresAt: expires ? new Date(expires).toISOString() : null,
            })}
            aria-label="Guardar cambios"
            className="text-accent transition-colors hover:opacity-80"
          >
            <Check size={16} weight="bold" />
          </button>
          <button disabled={disabled} onClick={onCancel} aria-label="Cancelar edicion" className="text-muted transition-colors hover:text-text">
            <X size={16} />
          </button>
        </span>
      </td>
    </tr>
  );
}
