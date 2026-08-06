"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House, Package, TShirt, Stack, Tag, Megaphone, ChartLine,
  CurrencyDollar, UsersThree, Gear, List, X, Storefront,
} from "@phosphor-icons/react";

const ICONS = {
  "/admin": House,
  "/admin/orders": Package,
  "/admin/products": TShirt,
  "/admin/inventory": Stack,
  "/admin/discounts": Tag,
  "/admin/promociones": Megaphone,
  "/admin/metricas": ChartLine,
  "/admin/comisiones": CurrencyDollar,
  "/admin/usuarios": UsersThree,
  "/admin/ajustes": Gear,
} as const;

export type NavItem = { href: string; label: string };

export function AdminSidebar({ items, signOut }: { items: NavItem[]; signOut: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // /admin only matches exactly; the rest match their section
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  // the bar is the only chrome on a phone, so it says where you are
  const title = items.find(({ href }) => isActive(href))?.label ?? "Admin";

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ href, label }) => {
        const Icon = ICONS[href as keyof typeof ICONS] ?? House;
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-elevated hover:text-text"
            }`}
          >
            <Icon size={17} weight={active ? "fill" : "regular"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-auto space-y-1 border-t border-border pt-3">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-elevated hover:text-text"
      >
        <Storefront size={17} /> Ver tienda
      </Link>
      {signOut}
    </div>
  );

  return (
    <>
      {/* mobile: top bar + drawer */}
      <div className="sticky top-0 z-40 -mx-4 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-md md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="-ml-2 grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:text-text"
        >
          <List size={22} />
        </button>
        <span className="font-semibold tracking-tight">{title}</span>
        <Link href="/" aria-label="Ver tienda" className="-mr-2 grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:text-text">
          <Storefront size={20} />
        </Link>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col gap-1 border-r border-border bg-bg p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold tracking-tight">Admin</span>
              <button onClick={() => setOpen(false)} aria-label="Cerrar menú" className="text-muted hover:text-text">
                <X size={18} />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* desktop: fixed rail */}
      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col gap-1 border-r border-border pr-4 md:flex">
        <span className="mb-3 px-3 font-semibold tracking-tight">Admin</span>
        {nav}
        {footer}
      </aside>
    </>
  );
}
