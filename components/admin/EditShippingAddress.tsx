"use client";

import { useState, useTransition } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { updateShippingAddress, type DireccionEnvio } from "@/app/admin/actions";

const CAMPOS: { k: keyof DireccionEnvio; label: string; inputMode?: "numeric" | "tel" }[] = [
  { k: "name", label: "Nombre" },
  { k: "phone", label: "Teléfono", inputMode: "tel" },
  { k: "line1", label: "Calle y número" },
  { k: "neighborhood", label: "Colonia" },
  { k: "city", label: "Ciudad" },
  { k: "region", label: "Estado" },
  { k: "postal", label: "Código postal", inputMode: "numeric" },
];

// Nombre, teléfono y domicilio del pedido, con edición en el mismo lugar.
export function EditShippingAddress({ orderId, ship, conGuia }: { orderId: string; ship: Record<string, string>; conGuia: boolean }) {
  const [editando, setEditando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // onSubmit, no `action`: React resetea el form tras una action y un error
  // borraría lo que el operador ya corrigió.
  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = Object.fromEntries(CAMPOS.map(({ k }) => [k, String(fd.get(k) ?? "")])) as DireccionEnvio;
    startTransition(async () => {
      setErr(null);
      const r = await updateShippingAddress(orderId, input);
      if (!r.ok) return setErr(r.error);
      setEditando(false);
    });
  }

  if (!editando) {
    return (
      <>
        {ship.name && <p className="font-medium">{ship.name}</p>}
        {ship.phone && <p className="nums text-muted">{ship.phone}</p>}
        {(ship.line1 || ship.city) && (
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {[ship.line1, ship.neighborhood, ship.city, ship.region, ship.postal].filter(Boolean).join(", ")}
          </p>
        )}
        <button
          onClick={() => setEditando(true)}
          className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <PencilSimple size={13} weight="bold" /> Editar dirección
        </button>
      </>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-2">
      {CAMPOS.map(({ k, label, inputMode }) => (
        <label key={k} className="block">
          <span className="text-xs text-muted">{label}</span>
          <input
            name={k}
            defaultValue={ship[k] ?? ""}
            inputMode={inputMode}
            className="mt-0.5 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-base sm:text-sm"
          />
        </label>
      ))}
      {conGuia && (
        <p className="rounded-lg bg-elevated p-2 text-xs text-muted">
          Este pedido ya tiene guía: la etiqueta impresa conserva la dirección anterior. Cancela la guía y genera otra si el paquete aún no sale.
        </p>
      )}
      {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-contrast disabled:opacity-50"
        >
          {isPending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => { setEditando(false); setErr(null); }}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-elevated"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
