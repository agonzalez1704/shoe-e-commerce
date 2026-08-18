"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Tag } from "@phosphor-icons/react";
import { activeBrand } from "@/lib/brand";
import { trackCheckout } from "@/components/AnalyticsBeacon";

// El gancho para crear cuenta. 40 de los 52 pedidos se hicieron como invitado,
// así que del comprador sólo quedaba un correo suelto en el pedido: nadie a
// quien volver a escribirle ni con quien armar una audiencia.
//
// Aparece al agregar al carrito y no antes. Interrumpir a quien apenas está
// mirando cuesta conversión y no gana nada: sin intención, el descuento no
// convence. Se dispara con un evento del botón "Agregar" en vez de leer el
// carrito, para no meterle otra consulta a cada vista de producto.
export const EVENTO_AGREGADO = "tienda:agregado";

const DESCARTADO = `${activeBrand.key}_bienvenida_no`;

export function CuentaBienvenida({ conSesion }: { conSesion: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (conSesion || localStorage.getItem(DESCARTADO)) return;
    const abrir = () => {
      setVisible(true);
      trackCheckout("bienvenida_vista");
    };
    window.addEventListener(EVENTO_AGREGADO, abrir);
    return () => window.removeEventListener(EVENTO_AGREGADO, abrir);
  }, [conSesion]);

  if (!visible) return null;

  const cerrar = () => {
    // Se recuerda el "no" — volver a aparecer en cada producto es lo que hace
    // que la gente odie estos avisos.
    localStorage.setItem(DESCARTADO, "1");
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 p-4 shadow-[0_-8px_24px_rgba(0,0,0,.25)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent sm:grid">
          <Tag size={18} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Llévate 10% en esta compra</p>
          <p className="mt-0.5 text-xs leading-snug text-muted">
            Crea tu cuenta y te damos un cupón de 10%. Es un toque con Google.
          </p>
        </div>
        <Link
          href="/cuenta?next=/cart"
          onClick={() => trackCheckout("bienvenida_clic")}
          className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98]"
        >
          Crear cuenta
        </Link>
        <button
          onClick={cerrar}
          aria-label="Cerrar"
          className="shrink-0 rounded-full p-2 text-muted transition-colors hover:text-text"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
