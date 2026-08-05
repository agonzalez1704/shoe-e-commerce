"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInventoryBulk } from "@/app/admin/actions";

export type SizeCell = {
  variantId: string;
  size: string;        // "26.5"
  sizeSystem: string;  // "MX"
  onHand: number;
  reserved: number;
};

export type Colorway = {
  productId: string;
  productName: string;
  color: string;
  madeToOrder: boolean;
  onHand: number;
  agotadas: number;
  sizes: SizeCell[];
};

export function InventoryColorway({ group }: { group: Colorway }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // edits keyed by variant, so an untouched size is never written
  const [draft, setDraft] = useState<Record<string, number>>({});

  const dirty = Object.entries(draft).filter(([id, v]) => {
    const s = group.sizes.find((x) => x.variantId === id);
    return s && v !== s.onHand;
  });

  function save() {
    setErr(null);
    start(async () => {
      const res = await setInventoryBulk(dirty.map(([variantId, qtyOnHand]) => ({ variantId, qtyOnHand })));
      if (!res.ok) { setErr(res.error); return; }
      setDraft({});
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {group.productName} <span className="capitalize text-muted">· {group.color}</span>
          </p>
          <p className="text-xs text-muted">
            {group.madeToOrder ? (
              <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-medium">sobre pedido</span>
            ) : (
              <>
                {group.onHand} pza{group.onHand === 1 ? "" : "s"} en total
                {group.agotadas > 0 && <span className="text-accent"> · {group.agotadas} talla(s) agotada(s)</span>}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {err && <span className="text-xs text-accent">{err}</span>}
          {saved && <span className="text-xs text-accent">✓ guardado</span>}
          <button
            onClick={save}
            disabled={!dirty.length || isPending}
            className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-contrast disabled:bg-border disabled:text-muted"
          >
            {isPending ? "Guardando…" : dirty.length ? `Guardar ${dirty.length}` : "Guardar"}
          </button>
        </div>
      </div>

      {/* one box per size — the shelf, not a list of rows */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
        {group.sizes.map((s) => {
          const value = draft[s.variantId] ?? s.onHand;
          const available = value - s.reserved;
          const changed = value !== s.onHand;
          const low = !group.madeToOrder && available <= 0;
          return (
            <label
              key={s.variantId}
              className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
                changed ? "border-accent bg-accent-soft/40" : low ? "border-accent/30" : "border-border"
              }`}
              title={s.reserved ? `${s.reserved} reservada(s)` : undefined}
            >
              <span className="text-[10px] font-medium text-muted">{s.size}</span>
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setDraft((d) => ({ ...d, [s.variantId]: Number(e.target.value) }))}
                className={`nums w-full rounded border-0 bg-transparent p-0 text-center text-sm outline-none ${
                  low ? "text-accent" : ""
                }`}
              />
              {s.reserved > 0 && <span className="text-[9px] text-muted">−{s.reserved}</span>}
            </label>
          );
        })}
      </div>
    </section>
  );
}
