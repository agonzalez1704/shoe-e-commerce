"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "@phosphor-icons/react";
import { getCartCount } from "@/app/cart/actions";

// Header cart icon + item count. The layout stays static (no cookies read during
// render, so ISR pages keep caching); the count is fetched client-side and
// refreshed on navigation and whenever something mutates the cart.
export const CART_CHANGED = "cart:changed";
export const notifyCartChanged = () => window.dispatchEvent(new Event(CART_CHANGED));

export function CartBadge() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const load = () => {
      getCartCount()
        .then((n) => { if (alive) setCount(n); })
        .catch(() => {});
    };
    load();
    window.addEventListener(CART_CHANGED, load);
    return () => { alive = false; window.removeEventListener(CART_CHANGED, load); };
  }, [pathname]);

  return (
    <>
      <ShoppingBag size={20} weight={count > 0 ? "fill" : "regular"} />
      {count > 0 && (
        <span
          aria-label={`${count} artículos en el carrito`}
          className="nums absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-contrast"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </>
  );
}
