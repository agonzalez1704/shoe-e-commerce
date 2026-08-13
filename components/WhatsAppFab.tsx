"use client";

import { useEffect, useRef, useState } from "react";
import { WhatsappLogo } from "@phosphor-icons/react";
import { activeBrand } from "@/lib/brand";
import { trackCheckout } from "@/components/AnalyticsBeacon";

// Botón flotante de WhatsApp para el checkout: la pantalla donde alguien se
// atora y se va sin decir por qué. La instrumentación del embudo ya mostró que
// 49 de 66 sesiones que llegaron aquí no crearon pedido.
//
// Se registra el toque como un paso más del checkout, así que `checkout_dropoff`
// dirá cuánta gente pide ayuda y desde dónde — sin eso es un botón del que nunca
// se sabría si sirve.
export function WhatsAppFab({ mensaje }: { mensaje?: string }) {
  const numero = activeBrand.legal.whatsapp;
  const ref = useRef<HTMLAnchorElement>(null);
  const [oculto, setOculto] = useState(false);

  // Nunca por encima del botón de pagar: tapar el botón de comprar para ofrecer
  // soporte es exactamente al revés.
  //
  // La pregunta es "¿el FAB tapa el CTA?", no "¿el CTA está en pantalla?". La
  // segunda mataba el botón en escritorio, donde el resumen es `lg:sticky`: el
  // CTA nunca se va, pero queda ~25px a la izquierda del FAB y no lo tapa nunca.
  //
  // Se comparan los rectángulos en vez de usar IntersectionObserver porque el
  // observer necesitaría un `rootMargin` recalculado contra el viewport, y esto
  // se puede comprobar de un vistazo. Son dos `getBoundingClientRect` por
  // scroll sobre una página que no virtualiza nada.
  useEffect(() => {
    const cta = document.querySelector("[data-pay-cta]");
    if (!numero || !cta) return;

    const revisar = () => {
      const a = cta.getBoundingClientRect();
      const b = ref.current?.getBoundingClientRect();
      if (!b) return;
      setOculto(!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom));
    };
    revisar();

    window.addEventListener("scroll", revisar, { passive: true });
    window.addEventListener("resize", revisar);
    return () => {
      window.removeEventListener("scroll", revisar);
      window.removeEventListener("resize", revisar);
    };
  }, [numero]);

  // Sin número configurado no se pinta: un enlace de WhatsApp a la nada es peor
  // que no ofrecerlo.
  if (!numero) return null;

  // El texto va genérico a propósito. La URL viaja en el historial del
  // navegador y en el portapapeles del comprador, así que no lleva su correo,
  // su nombre ni el contenido del carrito.
  const texto = mensaje ?? `Hola, tengo una duda con mi compra en ${activeBrand.name}.`;
  const href = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

  return (
    <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackCheckout("whatsapp")}
        aria-label="Escríbenos por WhatsApp"
        className={`fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[var(--shadow-md)] transition-all hover:scale-105 active:scale-95 ${
          oculto ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
      <WhatsappLogo size={30} weight="fill" />
    </a>
  );
}
