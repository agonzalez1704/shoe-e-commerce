"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CaretLeft, X } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { precioConPromo, precioPar, type ComboConfig } from "@/lib/pricing";
import type { ProductCard } from "@/lib/catalog";
import { agregarCombo } from "@/app/combo/actions";

// Wizard del combo en dos pasos: elige un par, elige el otro, paga. El precio
// depende de la piel de los dos (clasico / mixto / exotico, 0066) y cada
// tarjeta del paso 2 ya dice cuanto quedaria el combo con ESE par, para que
// el cliente nunca sume nada. Pensado para el pulgar: 90% de las visitas son
// desde celular.

type Sel = { key: string; variantId: string; talla: string };
type Filtro = "todos" | "clasico" | "exotico";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const STORAGE = "combo-wizard";
const TALLA_NUM = (t: string) => Number(t.replace(/[^\d.]/g, ""));

export function ComboWizard({
  cards,
  combo,
  par1Inicial,
}: {
  cards: ProductCard[];
  combo: ComboConfig;
  par1Inicial: { slug: string; color: string | null } | null;
}) {
  const porKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);
  const precioDe = (c: ProductCard) => precioConPromo(c.base_price_cents, c.promoPercent);

  const [par1, setPar1] = useState<Sel | null>(null);
  const [par2, setPar2] = useState<Sel | null>(null);
  const [hoja, setHoja] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [cargado, setCargado] = useState(false);

  // Lo elegido sobrevive a un cambio de pestaña o a volver a la ficha del producto.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE);
      if (raw) {
        const s = JSON.parse(raw) as { par1?: Sel | null; par2?: Sel | null };
        if (s.par1 && porKey.has(s.par1.key)) setPar1(s.par1);
        if (s.par2 && porKey.has(s.par2.key)) setPar2(s.par2);
      }
    } catch { /* sin storage: el wizard sigue funcionando */ }
    // Desde una ficha de producto: ese color abre su hoja de talla como par 1.
    if (par1Inicial) {
      const c = cards.find((x) => x.slug === par1Inicial.slug && (!par1Inicial.color || x.color === par1Inicial.color));
      if (c) { setPar1(null); setPar2(null); setHoja(c.key); }
    }
    setCargado(true);
  }, [cards, porKey, par1Inicial]);
  useEffect(() => {
    if (!cargado) return;
    try { sessionStorage.setItem(STORAGE, JSON.stringify({ par1, par2 })); } catch { /* nada */ }
  }, [par1, par2, cargado]);

  const paso: 1 | 2 | 3 = !par1 ? 1 : !par2 ? 2 : 3;
  const c1 = par1 ? porKey.get(par1.key) ?? null : null;
  const c2 = par2 ? porKey.get(par2.key) ?? null : null;
  const nEx = (a: ProductCard | null, b: ProductCard | null) => (a?.exotico ? 1 : 0) + (b?.exotico ? 1 : 0);

  const visibles = cards.filter((c) => filtro === "todos" || (filtro === "exotico") === c.exotico);

  // Precio con el que se anuncia cada tarjeta: en el paso 1, "desde" (con un
  // clasico); en el paso 2, el total real del combo con el par 1 ya elegido.
  const precioTarjeta = (c: ProductCard) => precioPar(combo, paso === 1 ? (c.exotico ? 1 : 0) : nEx(c1, c));

  function elegir(sel: Sel) {
    if (!par1) setPar1(sel); else setPar2(sel);
    setHoja(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const hojaCard = hoja ? porKey.get(hoja) ?? null : null;
  const cardsMostradas = paso === 3 ? [] : visibles;

  return (
    <div className="-mx-4 pb-32 md:mx-0">
      {/* cabecera fija: paso, progreso y, en el paso 2, el par 1 ya elegido */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          {paso === 1 ? (
            <Link href="/combo" aria-label="Volver" className="-ml-2 grid h-10 w-10 place-items-center"><CaretLeft size={20} weight="bold" /></Link>
          ) : (
            <button aria-label="Volver" onClick={() => (paso === 3 ? setPar2(null) : setPar1(null))} className="-ml-2 grid h-10 w-10 place-items-center"><CaretLeft size={20} weight="bold" /></button>
          )}
          <div className="text-center">
            <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${paso === 3 ? "text-emerald-600" : "text-accent"}`}>
              {paso === 3 ? "Listo" : `Paso ${paso} de 2`}
            </p>
            <h1 className="text-[17px] font-semibold">{paso === 1 ? "Elige tu primer par" : paso === 2 ? "Elige tu segundo par" : "Tu combo"}</h1>
          </div>
          <span className="w-10" />
        </div>
        <div className="mx-auto mt-2.5 flex max-w-3xl gap-1.5">
          <span className="h-1 flex-1 rounded-full bg-accent" />
          <span className={`h-1 flex-1 rounded-full ${paso >= 2 ? "bg-accent" : "bg-border"}`} />
        </div>
        {paso === 2 && c1 && par1 && (
          <div className="mx-auto mt-3 flex max-w-3xl items-center gap-3 rounded-2xl bg-elevated px-3 py-2">
            <Foto card={c1} className="h-11 w-11 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">Par 1 · {c1.name} <span className="capitalize">{c1.color}</span> · {par1.talla}</p>
              <p className="text-xs text-muted">
                {c1.exotico ? "Exótico" : "Clásico"}. Con un clásico pagas {mxn(precioPar(combo, nEx(c1, null)))}; con un exótico, {mxn(precioPar(combo, nEx(c1, null) + 1))}.
              </p>
            </div>
            <button onClick={() => setHoja(c1.key)} className="text-xs font-semibold underline">Cambiar</button>
          </div>
        )}
      </div>

      {paso !== 3 && (
        <>
          <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pt-3">
            {([["todos", "Todos"], ["clasico", `Clásicos · ${mxn(precioPar(combo, paso === 1 ? 0 : nEx(c1, null)))}`], ["exotico", `Exóticos · ${mxn(precioPar(combo, paso === 1 ? 1 : nEx(c1, null) + 1))}`]] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFiltro(id)}
                className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors ${filtro === id ? "bg-text text-bg" : "border border-border text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="mx-auto grid max-w-3xl grid-cols-2 gap-3 px-4 pt-3 sm:grid-cols-3 md:grid-cols-4">
            {cardsMostradas.map((c) => (
              <li key={c.key}>
                <button onClick={() => setHoja(c.key)} className="block w-full text-left">
                  <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-elevated">
                    {c.image && <Image src={c.image} alt={`${c.name} ${c.color ?? ""}`} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />}
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.exotico ? "bg-text text-bg" : "bg-surface/90 text-muted"}`}>
                      {c.exotico ? "Exótico" : "Clásico"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-tight">{c.name}</p>
                  <p className="text-xs capitalize text-muted">{c.color}</p>
                  {paso === 1 ? (
                    <p className="mt-1 text-xs text-muted">Combo desde <strong className="nums text-text">{mxn(precioTarjeta(c))}</strong></p>
                  ) : (
                    <span className={`nums mt-1 inline-block rounded-lg px-2 py-0.5 text-xs font-semibold ${nEx(c1, c) === 0 ? "bg-emerald-50 text-emerald-800" : "bg-accent-soft text-accent"}`}>
                      Combo {mxn(precioTarjeta(c))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {paso === 3 && c1 && c2 && par1 && par2 && (
        <Resumen c1={c1} c2={c2} par1={par1} par2={par2} combo={combo} precioDe={precioDe} onCambiar={(n) => (n === 1 ? setHoja(c1.key) : setPar2(null))} />
      )}

      {/* barra inferior: los dos huecos del combo, siempre visibles */}
      {paso !== 3 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 shadow-[var(--shadow-md)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex gap-1.5">
              {c1 ? <Foto card={c1} className="h-11 w-11 rounded-xl ring-2 ring-text" /> : <Hueco n={1} activo />}
              <Hueco n={2} activo={paso === 2} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Tu combo · {paso - 1} de 2</p>
              <p className="text-xs text-muted">{paso === 1 ? "Toca un par para elegir talla" : "Falta el segundo par"}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted">desde</p>
              <p className="nums text-lg font-bold">{mxn(precioPar(combo, paso === 1 ? 0 : nEx(c1, null)))}</p>
            </div>
          </div>
        </div>
      )}

      {hojaCard && (
        <HojaTalla
          card={hojaCard}
          hermanas={cards.filter((c) => c.slug === hojaCard.slug)}
          n={par1 && hoja !== par1.key ? 2 : 1}
          precioDesde={precioPar(combo, par1 && hoja !== par1.key ? nEx(c1, hojaCard) : (hojaCard.exotico ? 1 : 0))}
          precioDe={precioDe}
          onCambiarColor={(k) => setHoja(k)}
          onElegir={(variantId, talla) => {
            const sel = { key: hojaCard.key, variantId, talla };
            if (par1 && hoja === par1.key) { setPar1(sel); setHoja(null); return; } // cambiar el par 1
            elegir(sel);
          }}
          onClose={() => setHoja(null)}
        />
      )}
    </div>
  );
}

function Hueco({ n, activo }: { n: number; activo: boolean }) {
  return (
    <span className={`grid h-11 w-11 place-items-center rounded-xl border-2 border-dashed text-xs font-semibold ${activo ? "border-accent text-accent" : "border-border text-muted"}`}>{n}</span>
  );
}

function Foto({ card, className }: { card: ProductCard; className: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden bg-elevated ${className}`}>
      {card.image && <Image src={card.image} alt="" fill sizes="64px" className="object-cover" />}
    </span>
  );
}

// Hoja que sube desde abajo: color y talla sin perder la reja de atras.
function HojaTalla({ card, hermanas, n, precioDesde, precioDe, onCambiarColor, onElegir, onClose }: {
  card: ProductCard;
  hermanas: ProductCard[];
  n: 1 | 2;
  precioDesde: number;
  precioDe: (c: ProductCard) => number;
  onCambiarColor: (key: string) => void;
  onElegir: (variantId: string, talla: string) => void;
  onClose: () => void;
}) {
  const [talla, setTalla] = useState<{ variantId: string; talla: string } | null>(null);
  const tallas = [...card.tallas].sort((a, b) => TALLA_NUM(a.talla) - TALLA_NUM(b.talla));
  useEffect(() => setTalla(null), [card.key]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/55" />
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface pb-[max(env(safe-area-inset-bottom),20px)] shadow-[var(--shadow-md)]">
        <div className="flex justify-center pt-2.5"><span className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="flex items-center gap-3.5 px-5 pt-3">
          <Foto card={card} className="h-24 w-24 rounded-2xl border border-border" />
          <div className="min-w-0 flex-1">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${card.exotico ? "bg-text text-bg" : "bg-elevated text-muted"}`}>{card.exotico ? "Exótico" : "Clásico"}</span>
            <h2 className="mt-1 text-xl font-bold tracking-tight">{card.name}</h2>
            <p className="text-xs text-muted">
              Suelto <span className="nums line-through">{mxn(precioDe(card))}</span> · en combo <strong className="nums text-text">{mxn(precioDesde)}</strong> los 2
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 shrink-0 place-items-center self-start rounded-full bg-elevated"><X size={14} weight="bold" /></button>
        </div>

        {hermanas.length > 1 && (
          <div className="px-5 pt-4">
            <div className="mb-2 flex justify-between text-[13px]"><span className="font-semibold">Color</span><span className="capitalize text-muted">{card.color}</span></div>
            <div className="flex gap-2.5 overflow-x-auto">
              {hermanas.map((h) => (
                <button key={h.key} onClick={() => onCambiarColor(h.key)} aria-label={h.color ?? ""} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 ${h.key === card.key ? "border-text" : "border-border"}`}>
                  {h.image && <Image src={h.image} alt="" fill sizes="64px" className="object-cover" />}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 pt-4">
          <div className="mb-2 flex justify-between text-[13px]">
            <span className="font-semibold">Talla MX</span>
            <span className="text-muted">Horma normal</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {tallas.map((t) => {
              const on = talla?.variantId === t.variantId;
              return (
                <button
                  key={t.variantId}
                  disabled={!t.disponible}
                  onClick={() => setTalla({ variantId: t.variantId, talla: `MX ${t.talla}` })}
                  className={`nums h-[46px] rounded-xl border text-[15px] font-semibold transition-colors disabled:opacity-35 ${on ? "border-text bg-text text-bg" : "border-border bg-surface"}`}
                >
                  {t.talla}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-xs text-muted">Si dudas entre dos, elige la mayor: el cambio de talla es sin costo.</p>
        </div>

        <div className="px-5 pt-4">
          <button
            disabled={!talla}
            onClick={() => talla && onElegir(talla.variantId, talla.talla)}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-text text-base font-semibold text-bg transition-transform active:scale-[0.99] disabled:opacity-40"
          >
            {talla ? `Agregar como par ${n} · ${talla.talla}` : "Elige tu talla"}
            <ArrowRight size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Resumen({ c1, c2, par1, par2, combo, precioDe, onCambiar }: {
  c1: ProductCard; c2: ProductCard; par1: Sel; par2: Sel; combo: ComboConfig;
  precioDe: (c: ProductCard) => number;
  onCambiar: (n: 1 | 2) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nEx = (c1.exotico ? 1 : 0) + (c2.exotico ? 1 : 0);
  const total = precioPar(combo, nEx);
  const suelto = precioDe(c1) + precioDe(c2);
  const ahorro = Math.max(0, suelto - total);
  const tarifa = nEx === 0 ? "Combo clásico" : nEx === 1 ? "Combo mixto" : "Combo exótico";
  const detalle = nEx === 0 ? "Dos clásicos" : nEx === 1 ? "Un clásico + un exótico" : "Dos exóticos";

  const ir = (destino: "checkout" | "cart") =>
    start(async () => {
      setError(null);
      const r = await agregarCombo([par1.variantId, par2.variantId], destino);
      if (r && !r.ok) setError(r.error);
      else { try { sessionStorage.removeItem(STORAGE); } catch { /* nada */ } }
    });

  return (
    <div className="mx-auto max-w-3xl space-y-3.5 px-4 pt-4">
      <div className="grid grid-cols-2 gap-3">
        {[{ c: c1, s: par1, n: 1 as const }, { c: c2, s: par2, n: 2 as const }].map(({ c, s, n }) => (
          <div key={n} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="relative aspect-square bg-elevated">
              {c.image && <Image src={c.image} alt={`${c.name} ${c.color ?? ""}`} fill sizes="50vw" className="object-cover" />}
              <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-text text-xs font-bold text-bg">{n}</span>
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="text-xs capitalize text-muted">{c.color} · {s.talla}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.exotico ? "bg-text text-bg" : "bg-elevated text-muted"}`}>{c.exotico ? "Exótico" : "Clásico"}</span>
                <button onClick={() => onCambiar(n)} className="text-xs font-semibold underline">Cambiar</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div>
            <p className="text-[15px] font-semibold">{tarifa}</p>
            <p className="text-xs text-muted">{detalle}</p>
          </div>
          <div className="text-right">
            {ahorro > 0 && <p className="nums text-xs text-muted line-through">{mxn(suelto)}</p>}
            <p className="nums text-2xl font-bold leading-none tracking-tight">{mxn(total)}</p>
          </div>
        </div>
        <div className="space-y-1.5 pt-2.5 text-[13px]">
          <div className="flex justify-between"><span className="text-muted">{c1.name} <span className="capitalize">{c1.color}</span></span><span className="nums">{mxn(precioDe(c1))}</span></div>
          <div className="flex justify-between"><span className="text-muted">{c2.name} <span className="capitalize">{c2.color}</span></span><span className="nums">{mxn(precioDe(c2))}</span></div>
          {ahorro > 0 && <div className="flex justify-between font-semibold text-emerald-600"><span>Descuento del combo</span><span className="nums">−{mxn(ahorro)}</span></div>}
          <div className="flex justify-between"><span className="text-muted">Envío a todo México</span><span className="font-semibold text-emerald-600">Gratis</span></div>
        </div>
        {combo.mixtoCents != null && nEx === 1 && (
          <p className="mt-2.5 rounded-xl bg-accent-soft px-3 py-2 text-xs leading-relaxed text-accent">
            Si cambias el exótico por un clásico, el combo baja a <strong className="nums">{mxn(precioPar(combo, 0))}</strong>. Si cambias el clásico por otro exótico, sube a <strong className="nums">{mxn(precioPar(combo, 2))}</strong>.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted">
        {[["4 a 7 días", "se fabrica para ti"], ["Paga como quieras", "tarjeta, MSI, OXXO"], ["Cambio de talla", "sin costo"]].map(([t, s]) => (
          <div key={t} className="rounded-xl border border-border bg-surface px-1.5 py-2"><strong className="block text-text">{t}</strong>{s}</div>
        ))}
      </div>

      {error && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 shadow-[var(--shadow-md)]">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <button disabled={pending} onClick={() => ir("checkout")} className="flex h-[54px] items-center justify-center gap-2 rounded-full bg-accent text-base font-semibold text-accent-contrast transition-transform active:scale-[0.99] disabled:opacity-60">
            {pending ? "Un momento…" : `Pagar ${mxn(total)}`} <ArrowRight size={16} weight="bold" />
          </button>
          <button disabled={pending} onClick={() => ir("cart")} className="h-10 text-sm font-semibold disabled:opacity-60">Agregar al carrito y seguir viendo</button>
        </div>
      </div>
    </div>
  );
}
