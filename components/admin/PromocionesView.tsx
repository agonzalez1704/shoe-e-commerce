"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { precioConPromo } from "@/lib/pricing";
import {
  crearPromocion,
  editarPromocion,
  finalizarPromocion,
  reactivarPromocion,
  eliminarPromocion,
} from "@/app/admin/promo-actions";

export type ProductoOpcion = { id: string; name: string; base_price_cents: number };
export type PromoRow = {
  id: string;
  nombre: string;
  percent: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  productIds: string[];
};

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

function estado(p: PromoRow): { label: string; cls: string } {
  const now = Date.now();
  if (!p.active) return { label: "Detenida", cls: "bg-elevated text-muted" };
  if (now < +new Date(p.startsAt)) return { label: "Programada", cls: "bg-elevated text-text" };
  if (now > +new Date(p.endsAt)) return { label: "Terminada", cls: "bg-elevated text-muted" };
  return { label: "Activa", cls: "bg-accent text-accent-contrast" };
}

// ISO → valor de <input type="datetime-local"> en hora local (no UTC).
const aLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

export function PromocionesView({
  promos,
  productos,
}: {
  promos: PromoRow[];
  productos: ProductoOpcion[];
}) {
  // null = cerrado; "nueva" = alta; PromoRow = edicion de esa promo.
  const [form, setForm] = useState<null | "nueva" | PromoRow>(null);
  return (
    <div className="space-y-6">
      {form === null && (
        <button
          onClick={() => setForm("nueva")}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast"
        >
          Nueva promoción
        </button>
      )}

      {form !== null && (
        <PromoForm
          productos={productos}
          promo={form === "nueva" ? null : form}
          onClose={() => setForm(null)}
        />
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {promos.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted">Aún no hay promociones.</li>
        )}
        {promos.map((p) => (
          <PromoItem key={p.id} promo={p} onEdit={() => setForm(p)} />
        ))}
      </ul>
    </div>
  );
}

function PromoItem({ promo, onEdit }: { promo: PromoRow; onEdit: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const e = estado(promo);
  const vigente = e.label === "Activa" || e.label === "Programada";

  function run(fn: () => Promise<void>) {
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{promo.nombre}</span>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
            -{promo.percent}%
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.cls}`}>{e.label}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {fecha(promo.startsAt)} – {fecha(promo.endsAt)} · {promo.productIds.length} pares
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          onClick={onEdit}
          disabled={pending}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-elevated disabled:opacity-50"
        >
          Editar
        </button>
        {promo.active ? (
          <button
            onClick={() => run(() => finalizarPromocion(promo.id))}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-elevated disabled:opacity-50"
          >
            Finalizar
          </button>
        ) : (
          vigente && (
            <button
              onClick={() => run(() => reactivarPromocion(promo.id))}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-elevated disabled:opacity-50"
            >
              Reactivar
            </button>
          )
        )}
        <button
          onClick={() => {
            if (confirm(`¿Eliminar la promoción "${promo.nombre}"?`)) run(() => eliminarPromocion(promo.id));
          }}
          disabled={pending}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </li>
  );
}

function PromoForm({ productos, promo, onClose }: { productos: ProductoOpcion[]; promo: PromoRow | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState(promo?.nombre ?? "");
  const [percent, setPercent] = useState(promo ? String(promo.percent) : "15");
  const [startsAt, setStartsAt] = useState(promo ? aLocal(promo.startsAt) : "");
  const [endsAt, setEndsAt] = useState(promo ? aLocal(promo.endsAt) : "");
  const [sel, setSel] = useState<Set<string>>(new Set(promo?.productIds ?? []));
  const [q, setQ] = useState("");

  const pct = Number(percent);
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? productos.filter((p) => p.name.toLowerCase().includes(t)) : productos;
  }, [productos, q]);

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  function guardar() {
    start(async () => {
      try {
        const input = { nombre, percent: pct, startsAt, endsAt, productIds: [...sel] };
        if (promo) await editarPromocion(promo.id, input);
        else await crearPromocion(input);
        onClose();
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  const valido =
    nombre.trim() && pct >= 1 && pct <= 99 && startsAt && endsAt && new Date(endsAt) > new Date(startsAt) && sel.size > 0;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-elevated/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Rebaja de verano"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Descuento (%)</span>
          <input
            type="number"
            min={1}
            max={99}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Inicio</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Fin</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted">
            Pares ({sel.size} seleccionados) · combos no aplican
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="w-40 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm"
          />
        </div>
        <ul className="max-h-72 divide-y divide-border overflow-auto rounded-lg border border-border">
          {filtrados.map((p) => {
            const on = sel.has(p.id);
            const preview = pct >= 1 && pct <= 99 ? precioConPromo(p.base_price_cents, pct) : p.base_price_cents;
            return (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-elevated">
                  <input type="checkbox" checked={on} onChange={() => toggle(p.id)} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {on && preview < p.base_price_cents ? (
                      <>
                        <span className="line-through">{mxn(p.base_price_cents)}</span>{" "}
                        <span className="font-medium text-accent">{mxn(preview)}</span>
                      </>
                    ) : (
                      mxn(p.base_price_cents)
                    )}
                  </span>
                </label>
              </li>
            );
          })}
          {filtrados.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted">Sin coincidencias.</li>
          )}
        </ul>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} disabled={pending} className="rounded-lg border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={pending || !valido}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast disabled:opacity-50"
        >
          {pending ? "Guardando…" : promo ? "Guardar cambios" : "Crear promoción"}
        </button>
      </div>
    </div>
  );
}
