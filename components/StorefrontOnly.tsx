"use client";

import { usePathname } from "next/navigation";

/**
 * Storefront chrome — promo bar, header, footer — lives in the root layout, so
 * /admin was inheriting a cart icon and a "2 pares por $1,999" banner. A route
 * group would be the textbook fix but means moving every storefront folder;
 * this is a client boundary that costs one component. /admin is force-dynamic,
 * so the pathname is known during SSR and nothing flashes.
 */
export function StorefrontOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
