"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsString } from "nuqs";
import { Check, X } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { addToCart } from "@/app/cart/actions";
import { precioConPromo, precioPar, type ComboConfig } from "@/lib/pricing";
import { trackMeta } from "@/components/MetaPixel";
import { metaContentId } from "@/lib/meta-content";
import { notifyCartChanged } from "@/components/CartBadge";
import { EVENTO_AGREGADO } from "@/components/CuentaBienvenida";
import type { ProductCard } from "@/lib/catalog";

// Bloque de compra de la ficha. Tres ideas:
// 1. Color y talla arriba, sin bajar: antes la talla vivia ~1,500 px abajo.
// 2. Una barra fija en celular con las DOS compras: "solo este" y el combo.
//    Si tocan cualquiera sin talla, la talla sube en una hoja y el boton ya
//    dice que va a agregar. Nunca los mandamos a buscarla.
// 3. Al agregar un par suelto, la hoja ofrece el segundo con la diferencia ya
//    calculada ("por $640 mas"): el combo es la mayoria de las ventas.

type Variant = {
  id: string;
  size_value: string | null;
  size_system: string | null;
  width: string | null;
  color: string;
  price_cents: number | null;
  qty_available: number;
};
type Accion = "solo" | "combo";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const redondo = (c: number) => formatCents(c, "MXN", "es-MX").replace(/\.00$/, "");

export function CompraPdp({
  slug, name, variants, color, colores, onColorChange, madeToOrder, precioCents,
  combo, esExotico, sugeridos, sizeHint,
}: {
  slug: string;
  name: string;
  variants: Variant[];
  color: string;
  colores: { color: string; foto: string | null }[];
  onColorChange: (c: string) => void;
  madeToOrder: boolean;
  precioCents: number;         // precio efectivo del color (ya con promo)
  combo: ComboConfig | null;   // null: este color no entra al combo
  esExotico: boolean;
  sugeridos: ProductCard[];    // pares del combo para la invitacion
  sizeHint?: string;
}) {
  const router = useRouter();
  const [size, setSize] = useQueryState("talla", parseAsString.withOptions({ history: "replace" }));
  const [hoja, setHoja] = useState<Accion | null>(null);
  const [agregado, setAgregado] = useState<Variant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const sized = useMemo(() => variants.some((v) => v.size_value !== null), [variants]);
  const tallas = useMemo(
    () => variants.filter((v) => v.color === color).sort((a, b) => parseFloat(a.size_value ?? "0") - parseFloat(b.size_value ?? "0")),
    [variants, color],
  );
  const hay = (v: Variant) => madeToOrder || v.qty_available > 0;
  const elegida = sized ? tallas.find((v) => v.size_value === size && hay(v)) ?? null : tallas.find(hay) ?? null;
  const agotado = !madeToOrder && tallas.every((v) => v.qty_available <= 0);

  const precioPartner = (s: ProductCard) => precioConPromo(s.base_price_cents, s.promoPercent);
  const conClasico = combo ? precioPar(combo, esExotico ? 1 : 0) : null;
  const conExotico = combo && combo.mixtoCents != null ? precioPar(combo, esExotico ? 2 : 1) : null;
  const ahorroMax = combo
    ? Math.max(0, ...sugeridos.map((s) => precioCents + precioPartner(s) - precioPar(combo, (esExotico ? 1 : 0) + (s.exotico ? 1 : 0))))
    : 0;
  const clasicoSug = sugeridos.find((s) => !s.exotico) ?? null;
  const exoticoSug = sugeridos.find((s) => s.exotico) ?? null;

  const talla = (v: Variant) => `${v.size_system ?? ""} ${v.size_value ?? ""}`.trim();
  const urlCombo = (v: Variant, extra = "") =>
    `/combo/armar?par1=${slug}&color=${encodeURIComponent(color)}&variante=${v.id}${extra}`;

  function ejecutar(accion: Accion, v: Variant) {
    if (accion === "combo") {
      router.push(urlCombo(v));
      return;
    }
    startTransition(async () => {
      setError(null);
      notifyCartChanged(1);
      try {
        await addToCart(v.id, 1);
      } catch {
        // sin esto un fallo del servidor tumbaba toda la ficha
        notifyCartChanged();
        setError("No se pudo agregar al carrito. Intenta de nuevo.");
        return;
      }
      notifyCartChanged();
      window.dispatchEvent(new Event(EVENTO_AGREGADO));
      trackMeta("AddToCart", {
        content_ids: [metaContentId(slug, v.color)],
        content_type: "product",
        value: precioCents / 100,
        currency: "MXN",
      });
      setHoja(null);
      if (combo && sugeridos.length) setAgregado(v);
      else router.push("/cart");
    });
  }

  const pedir = (accion: Accion) => {
    if (elegida) ejecutar(accion, elegida);
    else if (sized) setHoja(accion);
  };

  const tallasGrid = (grande: boolean, onPick?: (v: Variant) => void) => (
    <div className="grid grid-cols-6 gap-1.5">
      {tallas.map((v) => {
        const oos = !hay(v);
        const on = v.size_value === size;
        return (
          <button
            key={v.id}
            type="button"
            disabled={oos}
            onClick={() => { setSize(v.size_value); onPick?.(v); }}
            aria-pressed={on}
            className={`nums rounded-xl border text-[15px] font-semibold transition-colors ${grande ? "h-12" : "h-11"} ${
              on ? "border-text bg-text text-bg" : oos ? "cursor-not-allowed border-border text-muted/40 line-through" : "border-border bg-surface hover:border-text"
            }`}
          >
            {v.size_value}
          </button>
        );
      })}
    </div>
  );

  const etiquetaSolo = elegida && sized ? `${talla(elegida)} · ${redondo(precioCents)}` : redondo(precioCents);

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p>}
      {/* color como foto: los modelos se parecen y el nombre no basta */}
      {colores.length > 0 && (
        <div>
          <div className="mb-2 flex justify-between text-[13px]">
            <span className="font-semibold">Color</span>
            <span className="capitalize text-muted">{color}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {colores.map((c) => (
              <button
                key={c.color}
                type="button"
                aria-label={c.color}
                aria-pressed={c.color === color}
                onClick={() => {
                  onColorChange(c.color);
                  if (!variants.some((v) => v.color === c.color && v.size_value === size)) setSize(null);
                }}
                className={`relative h-14 w-14 overflow-hidden rounded-xl border-2 bg-elevated transition-colors ${c.color === color ? "border-text" : "border-border hover:border-muted"}`}
              >
                {c.foto ? <Image src={c.foto} alt="" fill sizes="56px" className="object-cover" /> : <span className="text-[10px] capitalize">{c.color}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {sized && (
        <div id="size-picker" className="scroll-mt-24">
          <div className="mb-2 flex justify-between text-[13px]">
            <span className="font-semibold">Talla {tallas[0]?.size_system ?? ""}</span>
            <a href="#size-guide" className="text-muted underline">Guía de tallas</a>
          </div>
          {tallasGrid(false)}
          {sizeHint && <p className="mt-2 text-xs text-muted">{sizeHint}</p>}
        </div>
      )}

      {/* escritorio: las dos compras en el panel; en celular viven en la barra */}
      <div className="hidden flex-col gap-2 md:flex">
        {combo && (
          <button
            type="button"
            onClick={() => pedir("combo")}
            disabled={agotado}
            className="flex h-[58px] flex-col items-center justify-center rounded-2xl bg-accent text-accent-contrast transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            <span className="text-base font-bold">Arma tu combo con este par</span>
            <span className="text-xs opacity-90">
              2 pares desde {redondo(conClasico!)}{ahorroMax > 0 && ` · ahorra hasta ${redondo(ahorroMax)}`}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => pedir("solo")}
          disabled={agotado || isPending}
          className={`flex h-[50px] items-center justify-center rounded-2xl text-[15px] font-semibold transition-transform active:scale-[0.99] disabled:opacity-50 ${combo ? "border-[1.5px] border-border hover:border-text" : "bg-accent text-accent-contrast"}`}
        >
          {agotado ? "Agotado" : isPending ? "Agregando…" : combo ? `Solo este par · ${etiquetaSolo}` : `Agregar al carrito · ${etiquetaSolo}`}
        </button>
      </div>

      {/* el combo, con este par ya adentro */}
      {combo && conClasico != null && (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-bold">Llévalo en combo</p>
            {ahorroMax > 0 && (
              <span className="nums rounded-full bg-accent-soft px-2.5 py-0.5 text-[11.5px] font-bold text-accent">Ahorra hasta {redondo(ahorroMax)}</span>
            )}
          </div>
          <div className="mt-2.5 space-y-2">
            {[
              { label: "+ otro clásico", precio: conClasico, sug: clasicoSug },
              ...(conExotico != null ? [{ label: "+ un exótico", precio: conExotico, sug: exoticoSug }] : []),
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2.5">
                <div className="flex shrink-0">
                  {colores.find((c) => c.color === color)?.foto && (
                    <span className="relative h-9 w-9 overflow-hidden rounded-lg border-2 border-surface bg-elevated">
                      <Image src={colores.find((c) => c.color === color)!.foto!} alt="" fill sizes="36px" className="object-cover" />
                    </span>
                  )}
                  {f.sug?.image && (
                    <span className="relative -ml-2.5 h-9 w-9 overflow-hidden rounded-lg border-2 border-surface bg-elevated">
                      <Image src={f.sug.image} alt="" fill sizes="36px" className="object-cover" />
                    </span>
                  )}
                </div>
                <span className="flex-1 text-[13px] text-muted">{f.label}</span>
                <strong className="nums text-[15px]">{redondo(f.precio)}</strong>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => pedir("combo")}
            disabled={agotado}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-accent text-[14.5px] font-bold text-accent-contrast transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            Elegir mi segundo par →
          </button>
        </div>
      )}

      {/* barra fija de celular: las dos compras siempre a un toque */}
      {montado && createPortal(
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-bg/95 px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2.5 backdrop-blur-md md:hidden">
          {combo ? (
            <>
              <button
                type="button"
                onClick={() => pedir("solo")}
                disabled={agotado || isPending}
                className="flex h-[52px] flex-1 flex-col items-center justify-center rounded-2xl border-[1.5px] border-border disabled:opacity-50"
              >
                <span className="text-sm font-semibold">{agotado ? "Agotado" : isPending ? "Agregando…" : "Solo este"}</span>
                {!agotado && !isPending && <span className="nums text-[11.5px] text-muted">{etiquetaSolo}</span>}
              </button>
              <button
                type="button"
                onClick={() => pedir("combo")}
                disabled={agotado}
                className="flex h-[52px] flex-[1.35] flex-col items-center justify-center rounded-2xl bg-accent text-accent-contrast disabled:opacity-50"
              >
                <span className="text-[14.5px] font-bold">Arma tu combo</span>
                <span className="nums text-[11.5px] opacity-90">
                  {elegida && sized ? `con este ${talla(elegida)} · ` : "2 pares "}desde {redondo(conClasico!)}
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => pedir("solo")}
              disabled={agotado || isPending}
              className="flex h-[52px] flex-1 items-center justify-center rounded-2xl bg-accent text-[15px] font-bold text-accent-contrast disabled:opacity-50"
            >
              {agotado ? "Agotado" : isPending ? "Agregando…" : `Agregar al carrito · ${etiquetaSolo}`}
            </button>
          )}
        </div>,
        document.body,
      )}

      {/* hoja de talla: sube cuando tocan comprar sin talla */}
      {hoja && montado && createPortal(
        <Hoja onClose={() => setHoja(null)}>
          <div className="flex items-center gap-3">
            {colores.find((c) => c.color === color)?.foto && (
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-elevated">
                <Image src={colores.find((c) => c.color === color)!.foto!} alt="" fill sizes="64px" className="object-cover" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold">Elige tu talla</p>
              <p className="truncate text-[13px] capitalize text-muted">{name} · {color}</p>
            </div>
            <button type="button" onClick={() => setHoja(null)} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full bg-elevated"><X size={14} weight="bold" /></button>
          </div>
          <div className="mt-4">{tallasGrid(true)}</div>
          {error && <p role="alert" className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p>}
          <p className="mt-2.5 text-xs text-muted">{sizeHint ?? "¿Entre dos tallas? Elige la mayor: el cambio es sin costo."}</p>
          <button
            type="button"
            disabled={!elegida || isPending}
            onClick={() => elegida && ejecutar(hoja, elegida)}
            className={`mt-4 flex h-[54px] w-full items-center justify-center rounded-2xl text-[15.5px] font-bold transition-transform active:scale-[0.99] disabled:opacity-40 ${hoja === "combo" ? "bg-accent text-accent-contrast" : "bg-text text-bg"}`}
          >
            {!elegida
              ? "Toca tu talla"
              : isPending
                ? "Agregando…"
                : hoja === "combo"
                  ? `Seguir con ${talla(elegida)} → elegir el segundo par`
                  : `Agregar ${talla(elegida)} · ${redondo(precioCents)}`}
          </button>
        </Hoja>,
        document.body,
      )}

      {/* agregado: la invitacion al segundo par, con la diferencia ya calculada */}
      {agregado && combo && montado && createPortal(
        <Hoja onClose={() => setAgregado(null)}>
          <div className="flex items-center gap-3">
            {colores.find((c) => c.color === color)?.foto && (
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-elevated">
                <Image src={colores.find((c) => c.color === color)!.foto!} alt="" fill sizes="56px" className="object-cover" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[15px] font-bold">
                <Check size={16} weight="bold" className="text-emerald-500" /> Agregado al carrito
              </p>
              <p className="truncate text-[13px] capitalize text-muted">{name} · {color}{sized ? ` · ${talla(agregado)}` : ""} · {redondo(precioCents)}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft/40 p-3.5">
            <p className="text-base font-bold">
              Por <span className="nums text-accent">{redondo(Math.max(0, conClasico! - precioCents))} más</span> llévate otro par
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Combo {esExotico ? "mixto" : "clásico"} 2 × {redondo(conClasico!)}
              {conExotico != null && <> · con un exótico, {redondo(Math.max(0, conExotico - precioCents))} más</>}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {sugeridos.slice(0, 3).map((s) => {
                const mas = Math.max(0, precioPar(combo, (esExotico ? 1 : 0) + (s.exotico ? 1 : 0)) - precioCents);
                return (
                  <Link key={s.key} href={urlCombo(agregado, `&enCarrito=1&abrir=${encodeURIComponent(s.key)}`)} className="block">
                    <span className="relative block aspect-square overflow-hidden rounded-xl bg-elevated">
                      {s.image && <Image src={s.image} alt={`${s.name} ${s.color ?? ""}`} fill sizes="33vw" className="object-cover" />}
                    </span>
                    <span className="mt-1 block truncate text-[12.5px] font-semibold">{s.name}</span>
                    <span className="nums block text-[11.5px] font-semibold text-accent">+{redondo(mas)}</span>
                  </Link>
                );
              })}
            </div>
            <Link
              href={urlCombo(agregado, "&enCarrito=1")}
              className="mt-3 flex h-12 items-center justify-center rounded-xl bg-accent text-[14.5px] font-bold text-accent-contrast"
            >
              Elegir mi segundo par →
            </Link>
          </div>

          <div className="mt-2.5 flex gap-2">
            <Link href="/checkout" className="flex h-[46px] flex-1 items-center justify-center rounded-xl border-[1.5px] border-border text-sm font-semibold">Ir a pagar</Link>
            <button type="button" onClick={() => setAgregado(null)} className="flex h-[46px] flex-1 items-center justify-center rounded-xl text-sm font-semibold text-muted">Seguir viendo</button>
          </div>
        </Hoja>,
        document.body,
      )}
    </div>
  );
}

// Hoja que sube desde abajo (en escritorio, un panel centrado).
function Hoja({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/55" />
      <div role="dialog" aria-modal="true" className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-border bg-surface px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-2.5 shadow-[var(--shadow-md)] md:rounded-3xl md:border md:px-5 md:pt-5">
        <div className="mb-3 flex justify-center md:hidden"><span className="h-1 w-10 rounded-full bg-border" /></div>
        {children}
      </div>
    </div>
  );
}
