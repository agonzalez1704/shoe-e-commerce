"use client";

import { useActionState, useEffect, useState } from "react";
import { entrarAResena } from "@/app/resena/actions";

const INPUT = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-text";

export function ResenaAcceso() {
  const [estado, action, isPending] = useActionState(entrarAResena, null);
  // Un envio antes de hidratar cae al POST sin JS, que Next 16.3 truena al leer
  // cookies en el layout (InvariantError). Boton activo hasta hidratar.
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);
  return (
    <form key={JSON.stringify(estado)} action={action} className="space-y-3">
      <input name="o" placeholder="Número de pedido (ej. BL-001234)" defaultValue={estado?.o} required autoCapitalize="characters" className={INPUT} />
      <input name="e" type="email" placeholder="Correo del pedido" defaultValue={estado?.e} required className={INPUT} />
      {estado && <p className="text-sm text-accent">{estado.error}</p>}
      <button
        disabled={isPending || !listo}
        className="w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast disabled:bg-border disabled:text-muted"
      >
        {isPending ? "Buscando…" : "Continuar"}
      </button>
    </form>
  );
}
