"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { formatCents } from "@/lib/money";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "@/components/ui/select";
import { elegirComplemento } from "@/app/pedido/[orderNumber]/combo/actions";

// Reja del combo exprés: un clic elige el par, la talla en el mismo card, y el
// botón manda directo a pagar la diferencia. Sin carrito de por medio.

export type ParElegible = {
  nombre: string;
  color: string;
  imagen: string | null;
  variantes: { id: string; talla: string }[];
};

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export function ComboExpress({ pares, diffCents, orderNumber, token }: {
  pares: ParElegible[];
  diffCents: number;
  orderNumber: string;
  token: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  // talla elegida por card (llave nombre|color)
  const [sel, setSel] = useState<Record<string, string>>({});

  const pagar = (llave: string) => {
    const variantId = sel[llave];
    if (!variantId) { setErr("Elige la talla primero."); return; }
    startTransition(async () => {
      setErr(null);
      try {
        const r = await elegirComplemento(orderNumber, token, variantId);
        if (r && !r.ok) setErr(r.error);
        // en éxito la acción redirige a /pagar; no hay nada más que hacer aquí
      } catch {
        setErr("No se pudo apartar el par. Intenta de nuevo.");
      }
    });
  };

  return (
    <div className="mt-6">
      {err && <p className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent" role="alert">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pares.map((p) => {
          const llave = `${p.nombre}|${p.color}`;
          return (
            <div key={llave} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
              {p.imagen && (
                <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-elevated">
                  <Image src={p.imagen} alt={`${p.nombre} ${p.color}`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                </div>
              )}
              <p className="font-medium">{p.nombre}</p>
              <p className="text-xs capitalize text-muted">{p.color}</p>
              <div className="mt-3">
                <Select
                  value={sel[llave] ?? null}
                  onValueChange={(v) => { setSel((s) => ({ ...s, [llave]: v as string })); setErr(null); }}
                >
                  <SelectTrigger aria-label={`Talla para ${p.nombre} ${p.color}`} className="min-h-10 bg-surface">
                    <SelectValue>
                      {sel[llave] ? p.variantes.find((v) => v.id === sel[llave])?.talla : "Elige tu talla"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {p.variantes.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.talla}</SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <button
                disabled={isPending}
                onClick={() => pagar(llave)}
                className="mt-3 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {isPending ? "Apartando…" : `Pagar ${mxn(diffCents)}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
