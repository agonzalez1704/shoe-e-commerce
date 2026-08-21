"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { alternarCombo, configurarCombo, crearCombo } from "@/app/admin/combo-actions";

// Armador de combos: un tablero por grupo con switches por par. La decision de
// "entra / no entra" es un clic, pensado para moverse sobre la marcha.

export type ParCombo = {
  id: string;
  name: string;
  base_price_cents: number;
  combo_group: string | null;
  combo_min_qty: number | null;
  combo_price_cents: number | null;
  promo: boolean; // tiene promocion vigente — combos y promos son excluyentes
};

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const IN = "rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent";

export function CombosView({ pares }: { pares: ParCombo[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setErr(null);
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      }
    });

  const grupos = useMemo(() => {
    const m = new Map<string, { minQty: number; priceCents: number; miembros: ParCombo[] }>();
    for (const p of pares) {
      if (!p.combo_group || p.combo_min_qty == null || p.combo_price_cents == null) continue;
      const g = m.get(p.combo_group) ?? { minQty: p.combo_min_qty, priceCents: p.combo_price_cents, miembros: [] };
      g.miembros.push(p);
      m.set(p.combo_group, g);
    }
    return [...m.entries()];
  }, [pares]);

  const fuera = pares.filter((p) => !p.combo_group);

  return (
    <div className="space-y-6">
      {err && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{err}</p>}

      {grupos.map(([nombre, g]) => (
        <GrupoCard
          key={nombre}
          nombre={nombre}
          minQty={g.minQty}
          priceCents={g.priceCents}
          miembros={g.miembros}
          candidatos={fuera}
          pending={pending}
          run={run}
        />
      ))}

      {grupos.length === 0 && !creando && (
        <p className="rounded-xl border border-border px-4 py-6 text-center text-sm text-muted">
          Sin combos todavía.
        </p>
      )}

      {creando ? (
        <NuevoCombo pares={fuera} pending={pending} run={run} onClose={() => setCreando(false)} />
      ) : (
        <button
          onClick={() => setCreando(true)}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-elevated"
        >
          Nuevo combo
        </button>
      )}
    </div>
  );
}

function GrupoCard({
  nombre, minQty, priceCents, miembros, candidatos, pending, run,
}: {
  nombre: string;
  minQty: number;
  priceCents: number;
  miembros: ParCombo[];
  candidatos: ParCombo[];
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [qty, setQty] = useState(String(minQty));
  const [precio, setPrecio] = useState(String(priceCents / 100));
  const configCambio = Number(qty) !== minQty || Math.round(Number(precio) * 100) !== priceCents;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold capitalize">{nombre}</h2>
          <p className="text-xs text-muted">
            {miembros.length} pares · la oferta aplica combinando modelos del grupo
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-muted">
            Pares
            <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min={2} className={`${IN} nums mt-1 block w-16`} />
          </label>
          <span className="pb-1.5 text-sm text-muted">×</span>
          <label className="text-xs text-muted">
            Precio (MXN)
            <input value={precio} onChange={(e) => setPrecio(e.target.value)} type="number" min={1} step="0.01" className={`${IN} nums mt-1 block w-28`} />
          </label>
          {configCambio && (
            <button
              disabled={pending}
              onClick={() => run(() => configurarCombo(nombre, Number(qty), Math.round(Number(precio) * 100)))}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-50"
            >
              Guardar oferta
            </button>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {miembros.map((p) => (
          <FilaPar key={p.id} par={p} dentro pending={pending}
            onToggle={() => run(() => alternarCombo(p.id, null))} />
        ))}
        {candidatos.map((p) => (
          <FilaPar key={p.id} par={p} dentro={false} pending={pending}
            onToggle={() => run(() => alternarCombo(p.id, nombre))} />
        ))}
      </ul>
    </section>
  );
}

function FilaPar({ par, dentro, pending, onToggle }: {
  par: ParCombo; dentro: boolean; pending: boolean; onToggle: () => void;
}) {
  // Un par con promocion vigente no puede entrar: el cobro (create_order)
  // excluye combos de promos y viceversa; permitirlo aqui prometeria un
  // descuento que la caja no va a dar.
  const bloqueado = !dentro && par.promo;
  return (
    <li className={`flex items-center gap-3 px-4 py-2.5 text-sm ${dentro ? "" : "bg-elevated/40"}`}>
      <button
        role="switch"
        aria-checked={dentro}
        aria-label={`${par.name}: ${dentro ? "en el combo" : "fuera del combo"}`}
        disabled={pending || bloqueado}
        onClick={onToggle}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${dentro ? "bg-accent" : "bg-border"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left] ${dentro ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span className={`min-w-0 flex-1 truncate ${dentro ? "" : "text-muted"}`}>{par.name}</span>
      {bloqueado && <span className="shrink-0 text-xs text-muted">en promoción — no elegible</span>}
      <span className="nums shrink-0 text-muted">{mxn(par.base_price_cents)}</span>
    </li>
  );
}

function NuevoCombo({ pares, pending, run, onClose }: {
  pares: ParCombo[]; pending: boolean; run: (fn: () => Promise<void>) => void; onClose: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [qty, setQty] = useState("2");
  const [precio, setPrecio] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const valido = nombre.trim() && Number(qty) >= 2 && Number(precio) > 0 && sel.size >= Number(qty);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-elevated/40 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted">
          Nombre del combo
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="duo-otoño" className={`${IN} mt-1 block w-full`} />
        </label>
        <label className="text-xs text-muted">
          Pares por combo
          <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min={2} className={`${IN} nums mt-1 block w-full`} />
        </label>
        <label className="text-xs text-muted">
          Precio del combo (MXN)
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} type="number" min={1} step="0.01" className={`${IN} nums mt-1 block w-full`} />
        </label>
      </div>
      <ul className="max-h-72 divide-y divide-border overflow-auto rounded-xl border border-border">
        {pares.map((p) => (
          <li key={p.id}>
            <label className={`flex items-center gap-3 px-4 py-2 text-sm ${p.promo ? "opacity-50" : "cursor-pointer hover:bg-elevated"}`}>
              <input type="checkbox" disabled={p.promo} checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.promo && <span className="shrink-0 text-xs text-muted">en promoción</span>}
              <span className="nums shrink-0 text-muted">{mxn(p.base_price_cents)}</span>
            </label>
          </li>
        ))}
        {pares.length === 0 && <li className="px-4 py-4 text-center text-sm text-muted">Todos los pares ya están en un combo.</li>}
      </ul>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} disabled={pending} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
        <button
          disabled={pending || !valido}
          onClick={() => run(async () => { await crearCombo(nombre, Number(qty), Math.round(Number(precio) * 100), [...sel]); onClose(); })}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear combo"}
        </button>
      </div>
    </section>
  );
}
