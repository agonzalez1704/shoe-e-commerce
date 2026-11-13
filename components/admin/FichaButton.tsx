"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Descarga la ficha de producción y refresca: bajarla pasa el pedido a
// "Fabricando" en el servidor, y el panel de entrega tiene que reflejarlo.
export function FichaButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function descargar() {
    setPending(true);
    try {
      const res = await fetch(`/admin/orders/${orderNumber}/ficha`);
      if (!res.ok) throw new Error(await res.text());
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `ficha-${orderNumber}.pdf` });
      a.click();
      URL.revokeObjectURL(url);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error && e.message ? e.message : "No se pudo descargar la ficha");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={descargar}
      disabled={pending}
      className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-elevated disabled:opacity-50"
    >
      {pending ? "Descargando…" : "Descargar ficha de producción"}
    </button>
  );
}
