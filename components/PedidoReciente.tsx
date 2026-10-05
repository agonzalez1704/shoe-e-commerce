"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretRight, CheckCircle, UserCircle } from "@phosphor-icons/react";
import type { EstadoBarra, PedidoReciente } from "@/lib/pedido-reciente";

// Una sola consulta por carga de página, compartida por la barra, el ícono de
// cuenta y el carrito. Se rehace al cambiar de ruta solo si nunca respondió.
let pendiente: Promise<PedidoReciente | null> | null = null;
function cargar(): Promise<PedidoReciente | null> {
  pendiente ??= fetch("/api/pedido-reciente", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => (j.pedido ?? null) as PedidoReciente | null)
    .catch(() => {
      pendiente = null;
      return null;
    });
  return pendiente;
}

function usePedidoReciente() {
  const [pedido, setPedido] = useState<PedidoReciente | null>(null);
  useEffect(() => {
    let vivo = true;
    void cargar().then((p) => vivo && setPedido(p));
    return () => { vivo = false; };
  }, []);
  return pedido;
}

// Colores por estado: se distinguen por luminosidad además del tono.
const TONO: Record<EstadoBarra, { barra: string; punto: string }> = {
  pendiente: { barra: "bg-[#2a2412] text-[#f6e7b8]", punto: "bg-[#e8b84a]" },
  produccion: { barra: "bg-[#14301f] text-[#e8fbef]", punto: "bg-[#5fd08a]" },
  listo: { barra: "bg-[#14301f] text-[#e8fbef]", punto: "bg-[#5fd08a]" },
  camino: { barra: "bg-[#13253a] text-[#dcebff]", punto: "bg-[#6aa8ff]" },
  entregado: { barra: "bg-elevated text-text", punto: "bg-muted" },
};

// Franja arriba de todo el sitio mientras haya un pedido vivo. No se pinta en
// la página del propio pedido (ya lo está viendo) ni en el checkout.
export function BarraPedido() {
  const pedido = usePedidoReciente();
  const ruta = usePathname();
  if (!pedido || ruta.startsWith("/pedido/") || ruta.startsWith("/checkout")) return null;
  const t = TONO[pedido.estado];
  return (
    <Link href={pedido.url} className={`block ${t.barra}`}>
      <span className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-2 text-[13px]">
        <span className={`h-2 w-2 shrink-0 rounded-full ${t.punto}`} />
        {/* En celular, dos líneas: quién y en qué va, y debajo cuándo llega. */}
        <span className="min-w-0 flex-1 sm:truncate">
          <span className="block truncate sm:inline">
            <strong className="font-semibold">Tu pedido {pedido.numero}</strong> · {pedido.etiqueta}
          </span>
          {pedido.detalle && (
            <span className="block truncate text-xs opacity-80 sm:inline sm:text-[13px]">
              <span className="hidden sm:inline"> · </span>{pedido.detalle}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 font-semibold">
          Ver <CaretRight size={13} weight="bold" />
        </span>
      </span>
    </Link>
  );
}

// Ícono de cuenta. Con un pedido vivo lleva un punto y abre un menú (popover
// nativo, sin JS) con el pedido arriba; sin pedido es el link de siempre.
export function CuentaIcono() {
  const pedido = usePedidoReciente();
  const base = "grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:text-text";
  if (!pedido) {
    return (
      <Link href="/cuenta" aria-label="Cuenta" className={base}>
        <UserCircle size={20} weight="regular" />
      </Link>
    );
  }
  const t = TONO[pedido.estado];
  return (
    <>
      <button
        type="button" popoverTarget="menu-cuenta" aria-label={`Cuenta · pedido ${pedido.numero}`} className={`relative ${base}`}
        // El menú vive en la capa superior: se ancla justo debajo del ícono,
        // que se mueve según haya barra de pedido o no.
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const m = document.getElementById("menu-cuenta");
          if (m) { m.style.top = `${r.bottom + 8}px`; m.style.right = `${Math.max(16, window.innerWidth - r.right)}px`; }
        }}
      >
        <UserCircle size={20} weight="regular" />
        <span className={`absolute right-2 top-2 h-2 w-2 rounded-full ring-2 ring-bg ${t.punto}`} />
      </button>
      <div
        id="menu-cuenta"
        popover="auto"
        className="fixed inset-auto m-0 w-64 rounded-2xl border border-border bg-surface p-2 text-sm text-text shadow-[var(--shadow-md)]"
      >
        <Link href={pedido.url} className={`flex flex-col gap-0.5 rounded-xl px-3 py-2.5 ${t.barra}`}>
          <span className="font-semibold">Mi pedido {pedido.numero}</span>
          <span className="text-xs opacity-80">{pedido.etiqueta}{pedido.detalle ? ` · ${pedido.detalle}` : ""}</span>
        </Link>
        <Link href="/rastrear" className="block rounded-xl px-3 py-2.5 hover:bg-elevated">Rastrear otro pedido</Link>
        <Link href="/cuenta" className="block rounded-xl px-3 py-2.5 hover:bg-elevated">Mi cuenta</Link>
      </div>
    </>
  );
}

// Carrito vacío justo después de comprar: que no parezca que se perdió algo.
export function AvisoPedidoCarrito() {
  const pedido = usePedidoReciente();
  if (!pedido) return null;
  return (
    <div className="w-full max-w-md rounded-2xl border border-[#1f4a30] bg-[#10241a] p-5 text-left text-[#e8fbef]">
      <p className="flex items-center gap-1.5 text-xs text-[#a9d8b9]">
        <CheckCircle size={16} weight="fill" className="text-[#5fd08a]" /> Tu compra ya está hecha
      </p>
      <p className="mt-1.5 text-lg font-semibold">Pedido {pedido.numero} · {pedido.etiqueta}</p>
      <p className="mt-1 text-sm text-[#c9ccd2]">
        Por eso tu carrito está vacío.{pedido.detalle ? ` ${pedido.detalle}.` : ""}
      </p>
      <Link href={pedido.url} className="mt-4 flex h-12 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-contrast">
        Ver mi pedido
      </Link>
    </div>
  );
}
