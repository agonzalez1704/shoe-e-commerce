"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Check } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { addToCart } from "@/app/cart/actions";
import { notifyCartChanged } from "@/components/CartBadge";
import { trackMeta } from "@/components/MetaPixel";
import { metaContentId } from "@/lib/meta-content";

type Talla = { variantId: string; talla: string; disponible: boolean };

// Selector de talla + "Agregar" dentro de la tarjeta, para no obligar a entrar
// al producto por algo que ya se decidió en la reja.
//
// Sin talla elegida el botón no falla en silencio ni abre un modal: sacude la
// fila de tallas y la marca. Es la corrección más barata de entender —el ojo va
// solo a lo que se movió— y no saca a nadie de la reja.
export function CardTallas({
  tallas, slug, color, precioCents, tallaGuardada,
}: {
  tallas: Talla[];
  slug: string;
  color: string | null;
  precioCents: number;
  tallaGuardada?: string | null;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const disponibles = tallas.filter((t) => t.disponible);
  // La talla del último pedido evita el paso más molesto: quien ya compró
  // calzado nuestro sabe cuál es la suya y no quiere volver a decirla.
  const inicial = disponibles.find((t) => t.talla === tallaGuardada)?.talla ?? null;
  const [sel, setSel] = useState<string | null>(inicial);
  const [sacude, setSacude] = useState(false);
  const [error, setError] = useState(false);
  const [listo, setListo] = useState(false);
  const fila = useRef<HTMLDivElement>(null);

  // La talla guardada puede quedar fuera de la fila visible (29 en una tarjeta
  // angosta): se desliza la fila, no la página, para que se vea elegida.
  useEffect(() => {
    const el = fila.current;
    const on = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && on) el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.clientWidth / 2;
  }, []);

  if (!disponibles.length) {
    return <p className="mt-3 text-center text-xs text-muted">Agotado por ahora</p>;
  }

  const elegida = disponibles.find((t) => t.talla === sel);

  function agregar() {
    if (!elegida) {
      // La sacudida llama la mirada; el estado de error se queda hasta que
      // eligen — un aviso de 600ms no le sirve a quien parpadeó, y el mensaje
      // con role="alert" se lo lee el lector de pantalla.
      setError(true);
      setSacude(true);
      setTimeout(() => setSacude(false), 600);
      fila.current?.focus();
      return;
    }
    startTransition(async () => {
      await addToCart(elegida.variantId, 1, "tarjeta");
      // El contador del encabezado se mueve aquí, no al recargar: es la señal
      // de que el producto llegó a algún lado.
      notifyCartChanged(1);
      setListo(true);
      setTimeout(() => setListo(false), 1600);
      trackMeta("AddToCart", {
        content_ids: [metaContentId(slug, color ?? "")],
        content_type: "product",
        value: precioCents / 100,
        currency: "MXN",
      });
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      {/* Rediseño 2026-11 ("fuera desplegables"): las tallas a la vista, en una
          fila que se desliza con el dedo. El desplegable escondía cuáles había
          y costaba dos toques; aquí es uno y se ve qué está agotado. */}
      <div
        ref={fila}
        role="group"
        tabIndex={-1}
        aria-label="Talla MX"
        aria-describedby={error ? `err-${slug}-${color ?? ""}` : undefined}
        className={`no-scrollbar relative -mr-1 flex gap-1 overflow-x-auto overscroll-x-contain rounded-[10px] pr-1 outline-none ${sacude ? "animate-sacudida" : ""} ${error ? "ring-2 ring-accent/60" : ""}`}
      >
        {tallas.map((t) => {
          const on = t.talla === sel;
          return (
            <button
              key={t.variantId}
              type="button"
              disabled={!t.disponible}
              aria-pressed={on}
              aria-label={`Talla MX ${t.talla}${t.disponible ? "" : ", agotada"}`}
              onClick={() => { setSel(t.talla); setError(false); }}
              className={`nums h-11 min-w-[42px] shrink-0 rounded-[10px] border px-1.5 text-[13.5px] font-semibold transition-colors ${
                on
                  ? "border-text bg-text text-bg"
                  : t.disponible
                    ? "border-border bg-surface hover:border-text"
                    : "cursor-not-allowed border-border text-muted/40 line-through"
              }`}
            >
              {t.talla}
            </button>
          );
        })}
      </div>
      {/* Vive en el DOM siempre y cambia de contenido: así aria-live anuncia la
          aparición del error sin que el layout brinque (la línea reserva alto). */}
      <p
        id={`err-${slug}-${color ?? ""}`}
        role="alert"
        aria-live="polite"
        className={`mt-1 min-h-4 text-xs transition-opacity ${error ? "text-accent opacity-100" : "opacity-0"}`}
      >
        {error ? "Elige tu talla primero" : ""}
      </p>

      {/* Tres estados con su propio color: reposo, enviando y confirmado. Sin
          esto el botón se quedaba igual y la gente lo tocaba de nuevo. */}
      <motion.button
        type="button"
        onClick={agregar}
        disabled={pendiente}
        whileTap={{ scale: 0.97 }}
        animate={{ backgroundColor: listo ? "var(--color-success, #16a34a)" : "var(--color-accent)" }}
        transition={{ duration: 0.25 }}
        className="relative mt-2.5 flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-semibold text-accent-contrast disabled:cursor-wait"
      >
        <AnimatePresence mode="wait" initial={false}>
          {listo ? (
            <motion.span
              key="listo"
              className="flex items-center gap-1.5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Check size={15} weight="bold" /> En tu carrito
            </motion.span>
          ) : pendiente ? (
            <motion.span
              key="enviando"
              className="flex items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* el artículo cayendo dentro de la bolsa */}
              <motion.span
                animate={{ y: [-9, 0], opacity: [0, 1, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeIn" }}
                className="inline-flex"
              >
                <ShoppingBag size={15} weight="fill" />
              </motion.span>
              Agregando…
            </motion.span>
          ) : (
            <motion.span
              key="reposo"
              className="flex items-center gap-1.5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <ShoppingBag size={15} weight="fill" /> {sel ? `Agregar MX ${sel}` : "Agregar al carrito"}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
