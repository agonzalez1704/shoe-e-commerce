"use client";

import { useEffect, useState } from "react";
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
  const [oculto, setOculto] = useState(false);

  // Nunca por encima del botón de pagar. Un FAB abajo a la derecha cae justo
  // sobre el CTA de ancho completo cuando el comprador llega al final, y tapar
  // el botón de comprar para ofrecer soporte es exactamente al revés.
  useEffect(() => {
    if (!numero) return;
    const cta = document.querySelector("[data-pay-cta]");
    if (!cta) return;
    const io = new IntersectionObserver(([e]) => setOculto(e.isIntersecting), { threshold: 0.1 });
    io.observe(cta);
    return () => io.disconnect();
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
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackCheckout("whatsapp")}
        aria-label="Escríbenos por WhatsApp"
        className={`fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[var(--shadow-md)] transition-all hover:scale-105 active:scale-95 ${
          oculto ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100"
        }`}
      >
      <WhatsappLogo size={30} weight="fill" />
    </a>
  );
}
