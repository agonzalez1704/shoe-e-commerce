"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";

/**
 * Storefront chrome — promo bar, header, footer — lives in the root layout, so
 * /admin was inheriting a cart icon and a "2 pares por $1,999" banner. A route
 * group would be the textbook fix but means moving every storefront folder.
 *
 * usePathname bloquea el prerender del shell con cacheComponents, así que va
 * bajo Suspense con el cromo MISMO de fallback: toda ruta de tienda lo quiere
 * en el primer pintado, y /admin es bloqueante (instant = false) — ahí el
 * pathname se resuelve en el server y esto renderiza null sin ver el fallback.
 */
function SoloTienda({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}

export function StorefrontOnly({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={children}><SoloTienda>{children}</SoloTienda></Suspense>;
}
