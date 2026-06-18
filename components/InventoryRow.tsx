"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "@phosphor-icons/react";
import { setInventory } from "@/app/admin/actions";

export type InvRow = {
  variantId: string;
  productName: string;
  label: string;
  sku: string;
  onHand: number;
  reserved: number;
};

export function InventoryRow({ row }: { row: InvRow }) {
  const [value, setValue] = useState(row.onHand);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const available = value - row.reserved;
  const dirty = value !== row.onHand;

  function save() {
    startTransition(async () => {
      await setInventory(row.variantId, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    });
  }

  return (
    <tr className="transition-colors hover:bg-elevated">
      <td className="px-4 py-3">
        <p className="font-medium">{row.productName}</p>
        <p className="text-xs capitalize text-muted">{row.label} · <span className="nums">{row.sku}</span></p>
      </td>
      <td className="nums px-4 py-3 text-right text-muted">{row.reserved}</td>
      <td className={`nums px-4 py-3 text-right ${available <= 3 ? "text-accent" : ""}`}>{available}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="nums w-20 rounded-lg border border-border bg-surface px-2 py-1 text-right text-sm outline-none focus:border-text"
          />
          <button
            onClick={save}
            disabled={!dirty || isPending}
            className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-contrast disabled:bg-border disabled:text-muted"
            aria-label="Guardar"
          >
            <Check size={16} weight="bold" />
          </button>
          {saved && <span className="text-xs text-accent">✓</span>}
        </div>
      </td>
    </tr>
  );
}
