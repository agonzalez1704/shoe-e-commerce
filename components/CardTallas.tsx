"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "@phosphor-icons/react";
import { addToCart } from "@/app/cart/actions";
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
  const fila = useRef<HTMLDivElement>(null);

  if (!disponibles.length) {
    return <p className="mt-3 text-center text-xs text-muted">Agotado por ahora</p>;
  }

  const elegida = disponibles.find((t) => t.talla === sel);

  function agregar() {
    if (!elegida) {
      setSacude(true);
      setTimeout(() => setSacude(false), 600);
      // Quien llega con teclado o lector de pantalla no ve la sacudida.
      fila.current?.focus();
      return;
    }
    startTransition(async () => {
      await addToCart(elegida.variantId, 1);
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
      <div
        ref={fila}
        tabIndex={-1}
        aria-label="Elige tu talla"
        className={`flex flex-wrap gap-1.5 outline-none ${sacude ? "animate-sacudida" : ""}`}
      >
        {disponibles.map((t) => (
          <button
            key={t.variantId}
            type="button"
            onClick={() => setSel(t.talla)}
            aria-pressed={sel === t.talla}
            className={`min-w-9 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
              sel === t.talla
                ? "border-accent bg-accent text-accent-contrast"
                : sacude
                  ? "border-accent text-accent"
                  : "border-border text-muted hover:border-muted hover:text-text"
            }`}
          >
            {t.talla}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={agregar}
        disabled={pendiente}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        <ShoppingBag size={15} weight="fill" />
        {pendiente ? "Agregando…" : "Agregar al carrito"}
      </button>
    </div>
  );
}
