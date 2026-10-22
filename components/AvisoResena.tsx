"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "@phosphor-icons/react";
import { campanaResenaPendiente } from "@/app/cuenta/actions";
import { CUPON_RESENA } from "@/lib/reviews-shared";
import { activeBrand } from "@/lib/brand";

type Pendiente = NonNullable<Awaited<ReturnType<typeof campanaResenaPendiente>>>;

const CERRADO = "aviso-resena-cerrado"; // localStorage: cuándo dijo "ahora no"
const VISTO = "aviso-resena-visto";     // sessionStorage: ya se consultó en esta visita
const PAUSA_MS = 3 * 864e5;
// Donde ya se está reseñando, pagando o viendo la cuenta (que tiene su propio aviso).
const FUERA = ["/resena", "/checkout", "/cuenta", "/pedido", "/carrito"];

const leer = (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } };
const guardar = (s: Storage, k: string, v: string) => { try { s.setItem(k, v); } catch {} };

// Al entrar con sesión: si tiene un pedido entregado al que le falta la reseña
// o la foto, se le ofrece su regalo (10% o cartera). Una consulta por visita y, si lo cierra, no
// vuelve a salir en 3 días.
export function AvisoResena() {
  const pathname = usePathname();
  const [p, setP] = useState<Pendiente | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (FUERA.some((r) => pathname?.startsWith(r))) return;
    if (leer(sessionStorage, VISTO)) return;
    if (Date.now() - Number(leer(localStorage, CERRADO) ?? 0) < PAUSA_MS) return;
    guardar(sessionStorage, VISTO, "1");
    campanaResenaPendiente()
      .then((r) => { if (r) { setP(r); setOpen(true); } })
      .catch(() => {});
  }, [pathname]);

  if (!p) return null;
  const foto = p.paso === "foto";
  const cerrar = () => { guardar(localStorage, CERRADO, String(Date.now())); setOpen(false); };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-x-4 bottom-4 z-50 mx-auto max-h-[calc(100svh-2rem)] max-w-md overflow-y-auto rounded-3xl border border-border bg-surface shadow-2xl transition-[opacity,translate] duration-200 data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:data-ending-style:-translate-y-[calc(50%-1rem)] sm:data-starting-style:-translate-y-[calc(50%-1rem)]">
          <div className="relative">
            <Image
              src="/blade-promo-resenas-modal.webp"
              alt={`${CUPON_RESENA.porcentaje}% de descuento en tu próxima compra`}
              width={720}
              height={610}
              sizes="(max-width: 480px) 100vw, 448px"
              className="block h-auto w-full"
            />
            <Dialog.Close
              aria-label="Cerrar"
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X size={18} weight="bold" />
            </Dialog.Close>
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <p className="nums text-[11px] tracking-[0.12em] text-accent">
                {foto ? "TE FALTA UN PASO" : p.total > 1 ? `TIENES ${p.total} PEDIDOS SIN RESEÑA` : "TU PEDIDO YA LLEGÓ"}
              </p>
              <Dialog.Title className="text-[22px] font-semibold leading-tight">
                {foto
                  ? `Comparte una foto con tus ${activeBrand.name} y llévate ${CUPON_RESENA.porcentaje}% o una cartera`
                  : `Reseña tus ${activeBrand.name}, compártelos en una foto y gana ${CUPON_RESENA.porcentaje}% o una cartera en tu próxima compra`}
              </Dialog.Title>
            </div>
            <ol className="grid grid-cols-2 gap-2">
              {[`Tu reseña en ${activeBrand.domain}`, `Una foto con tus ${activeBrand.name} etiquetándonos en Instagram o Facebook`].map((t, i) => (
                <li key={t} className={`space-y-1 rounded-2xl bg-elevated p-3 ${foto && i === 0 ? "opacity-60" : ""}`}>
                  <span className="nums block text-lg font-semibold">{foto && i === 0 ? "✓" : i + 1}</span>
                  <span className="block text-xs leading-snug text-muted">{t}</span>
                </li>
              ))}
            </ol>
            <Link
              href={`/resena/${p.token}${foto ? "#paso2" : ""}`}
              onClick={cerrar}
              className="flex h-12 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-accent-contrast"
            >
              {foto ? "Subir mi foto" : "Dejar mi reseña"}
            </Link>
            <Dialog.Close className="h-11 w-full text-sm text-muted">Ahora no</Dialog.Close>
            <Dialog.Description className="text-center text-[11px] leading-snug text-muted">
              Buena o mala, la queremos honesta. El descuento no depende de la calificación.
            </Dialog.Description>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
