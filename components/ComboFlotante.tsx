"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { getCartCount } from "@/app/cart/actions";
import { CART_CHANGED } from "@/components/CartBadge";

// Barra flotante de la portada: acompaña el scroll para que el combo quede a un
// toque aunque el cliente baje hasta el final. Se esconde arriba del todo (ahi
// ya esta el hero) y cuando hay algo en el carrito (ahi manda PieCarrito).
export function ComboFlotante({ precioDesde, fotos }: { precioDesde: string; fotos: string[] }) {
  const [visible, setVisible] = useState(false);
  const [carrito, setCarrito] = useState(0);
  // Portal al body: dentro de la pagina un ancestro con transform (el reveal)
  // convierte el `fixed` en relativo y la barra se queda al final del scroll.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () => getCartCount().then((n) => { if (alive) setCarrito(n); }).catch(() => {});
    load();
    window.addEventListener(CART_CHANGED, load);
    return () => { alive = false; window.removeEventListener(CART_CHANGED, load); };
  }, []);

  const mostrar = visible && carrito === 0;
  if (!montado) return null;
  return createPortal(
    <div
      aria-hidden={!mostrar}
      className={`fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center gap-3 rounded-full bg-text py-2.5 pl-3.5 pr-2.5 text-bg shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition-all duration-300 ${mostrar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
    >
      <div className="flex">
        {fotos.slice(0, 2).map((f, i) => (
          <span key={f} className={`relative h-9 w-9 overflow-hidden rounded-xl border-2 border-text bg-elevated ${i > 0 ? "-ml-2.5" : ""}`}>
            <Image src={f} alt="" fill sizes="36px" className="object-cover" />
          </span>
        ))}
      </div>
      <div className="flex-1 leading-tight">
        <p className="text-[13.5px] font-semibold">Arma tu combo</p>
        <p className="text-[11.5px] opacity-70">2 pares desde {precioDesde}</p>
      </div>
      <Link href="/combo" className="rounded-full bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-accent-contrast">Empezar</Link>
    </div>,
    document.body,
  );
}
