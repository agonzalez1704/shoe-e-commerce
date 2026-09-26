"use client";

import { usePathname } from "next/navigation";

// El not-found no recibe params: el nombre del modelo sale de la direccion
// (/products/new-york → "New York"). Si no hay slug, un titulo generico.
export function NombreModelo() {
  const slug = usePathname().split("/").filter(Boolean)[1] ?? "";
  const nombre = decodeURIComponent(slug)
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return <>{nombre ? `${nombre} ya no está disponible` : "Este modelo ya no está disponible"}</>;
}
