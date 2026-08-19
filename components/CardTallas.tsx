"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Check, CaretDown } from "@phosphor-icons/react";
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
  const fila = useRef<HTMLSelectElement>(null);

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
      await addToCart(elegida.variantId, 1);
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
      {/* <select> nativo, no un dropdown propio: en iOS abre la rueda del
          sistema y en Android su hoja inferior — el comportamiento nativo que
          un menú hecho a mano nunca iguala en móvil. Los 11 chips de antes se
          leían como un calendario en pantallas angostas. */}
      <div className={`relative ${sacude ? "animate-sacudida" : ""}`}>
        <select
          ref={fila}
          value={sel ?? ""}
          onChange={(e) => { setSel(e.target.value || null); if (e.target.value) setError(false); }}
          aria-label="Elige tu talla"
          aria-invalid={error || undefined}
          aria-describedby={error ? `err-${slug}-${color ?? ""}` : undefined}
          className={`h-10 w-full cursor-pointer appearance-none rounded-lg border bg-surface pl-3 pr-9 text-sm font-medium outline-none transition-colors ${
            error
              ? "border-accent/80 text-accent focus:border-accent/80 focus:ring-2 focus:ring-accent/20"
              : sel
                ? "border-border text-text focus:border-accent"
                : "border-border text-muted focus:border-accent"
          }`}
        >
          <option value="">Elige tu talla</option>
          {disponibles.map((t) => (
            <option key={t.variantId} value={t.talla}>
              MX {t.talla}
            </option>
          ))}
        </select>
        <CaretDown
          size={14}
          weight="bold"
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${error ? "text-accent/80" : "text-muted"}`}
        />
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
              <ShoppingBag size={15} weight="fill" /> Agregar al carrito
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
