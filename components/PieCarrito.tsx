"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBag, ArrowRight } from "@phosphor-icons/react";
import { getCartCount } from "@/app/cart/actions";
import { CART_CHANGED } from "@/components/CartBadge";

// Pie fijo en la reja: con algo en el carrito, el camino a pagar queda a un
// toque sin buscar el icono del encabezado. Vive solo en las páginas de
// listado — en el checkout estorbaría y en la PDP compite con el CTA propio.
export function PieCarrito() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const load = () => getCartCount().then((n) => { if (alive) setCount(n); }).catch(() => {});
    const alCambiar = (e: Event) => {
      const suma = (e as CustomEvent<{ suma?: number }>).detail?.suma ?? 0;
      if (suma) setCount((c) => c + suma); // optimista, igual que el badge
      load();
    };
    load();
    window.addEventListener(CART_CHANGED, alCambiar);
    return () => { alive = false; window.removeEventListener(CART_CHANGED, alCambiar); };
  }, [pathname]);

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-muted">
              <ShoppingBag size={16} weight="fill" className="text-text" />
              <span className="nums font-semibold text-text">{count}</span>
              {count === 1 ? "artículo listo" : "artículos listos"}
            </p>
            <Link
              href="/checkout"
              className="flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98]"
            >
              Ir a pagar <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
