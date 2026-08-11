"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X, CaretDown } from "@phosphor-icons/react";
import type { CategoryLink } from "@/lib/catalog";

// The store's navigation. It owns the whole header because the mobile panel has
// to sit *below* the sticky bar and push nothing — an overlay would need a focus
// trap, and `position: fixed` inside a sticky ancestor misbehaves on iOS.
//
// `logo` and `actions` arrive already rendered on the server: this file is a
// client component only because the panel opens and closes.
export function SiteHeader({
  categories,
  logo,
  actions,
}: {
  categories: CategoryLink[];
  logo: React.ReactNode;
  actions: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation. This is the only reason the panel is not a plain
  // <details>: tapping a category has to dismiss it.
  useEffect(() => setOpen(false), [pathname]);

  // Escape, and a click anywhere outside the header. A backdrop <div> was the
  // obvious alternative and it does not work here: the menu lives inside a
  // z-50 sticky header, so the backdrop is either above the header (and eats
  // the toggle's own click) or below the page (and never receives one).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element)?.closest("header")) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const has = categories.length > 0;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-1">
          {has && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="nav-categorias"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              // First element in the header and 44px square: on a phone this is
              // the one control that has to be reachable with the thumb.
              className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:text-text md:hidden"
            >
              {open ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
            </button>
          )}
          {logo}
        </div>
        <div className="flex items-center gap-1">
          {/* Tienda es un destino, no un contenedor: llevaba dentro las
              categorías y para ver todo el catálogo había que abrir un menú.
              Ahora es un enlace directo y las categorías tienen el suyo. */}
          <Link
            href="/products"
            // En móvil sobra: la hamburguesa ya lleva "Toda la tienda", y
            // ponerlo también en la barra parte el logo en dos líneas. Sin
            // categorías no hay hamburguesa, así que ahí sí tiene que verse.
            className={`rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-text ${has ? "hidden md:block" : ""}`}
          >
            Tienda
          </Link>
          {has && (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="nav-categorias-md"
                className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-text"
              >
                Categorías
                <CaretDown size={13} weight="bold" className={open ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
              {/* click to open, not hover: a hover menu is a dead end on touch
                  and would need a separate keyboard path anyway */}
              {open && (
                <div
                  id="nav-categorias-md"
                  className="absolute right-0 top-full mt-1 min-w-56 rounded-2xl border border-border bg-surface p-1.5 shadow-[var(--shadow-md)]"
                >
                  {categories.map((c) => (
                    <Row key={c.slug} href={`/categoria/${c.slug}`} label={c.name} count={c.count} />
                  ))}
                </div>
              )}
            </div>
          )}
          {actions}
        </div>
      </nav>

      {/* Mobile: pushes down under the bar rather than floating over the page.
          Flat rows, no accordion — these categories do not nest. */}
      {has && (
        <div id="nav-categorias" hidden={!open} className="border-t border-border bg-bg md:hidden">
          <div className="mx-auto max-w-6xl px-2 py-2">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Categorías
            </p>
            {categories.map((c) => (
              <Row key={c.slug} href={`/categoria/${c.slug}`} label={c.name} count={c.count} />
            ))}
            <div className="my-1.5 border-t border-border" />
            <Row href="/products" label="Toda la tienda" />
            <Row href="/rastrear" label="Rastrear pedido" />
            <Row href="/cuenta" label="Mi cuenta" />
          </div>
        </div>
      )}
    </header>
  );
}

function Row({ href, label, count }: { href: string; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl px-3 text-sm text-text transition-colors hover:bg-elevated"
    >
      {label}
      {count != null && <span className="nums text-xs text-muted">{count}</span>}
    </Link>
  );
}
