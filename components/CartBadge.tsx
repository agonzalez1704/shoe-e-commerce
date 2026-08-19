"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "@phosphor-icons/react";
import { getCartCount } from "@/app/cart/actions";

// Header cart icon + item count. The layout stays static (no cookies read during
// render, so ISR pages keep caching); the count is fetched client-side and
// refreshed on navigation and whenever something mutates the cart.
export const CART_CHANGED = "cart:changed";

// `suma` mueve el contador antes de que el servidor conteste. Agregar al
// carrito tardaba lo suyo y en ese hueco no pasaba nada visible, así que la
// gente volvía a tocar el botón. El número real llega después y corrige.
export const notifyCartChanged = (suma = 0) =>
  window.dispatchEvent(new CustomEvent(CART_CHANGED, { detail: { suma } }));

export function CartBadge() {
  const [count, setCount] = useState(0);
  const [brinca, setBrinca] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      getCartCount()
        .then((n) => { if (alive) setCount(n); })
        .catch(() => {});
    };
    const alCambiar = (e: Event) => {
      const suma = (e as CustomEvent<{ suma?: number }>).detail?.suma ?? 0;
      if (suma) {
        setCount((c) => c + suma);
        setBrinca(true);
        setTimeout(() => alive && setBrinca(false), 450);
      }
      load(); // la cuenta real corrige la optimista
    };
    load();
    window.addEventListener(CART_CHANGED, alCambiar);
    return () => { alive = false; window.removeEventListener(CART_CHANGED, alCambiar); };
  }, []);

  return (
    <>
      <ShoppingBag size={20} weight={count > 0 ? "fill" : "regular"} className={brinca ? "animate-brinco" : ""} />
      {count > 0 && (
        <span
          aria-label={`${count} artículos en el carrito`}
          className={`nums absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-contrast ${brinca ? "animate-brinco" : ""}`}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </>
  );
}
