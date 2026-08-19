"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart, X } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { alternarFavorito, migrarFavoritos, listarFavoritos } from "@/app/favoritos/actions";
import { activeBrand } from "@/lib/brand";
import { trackCheckout } from "@/components/AnalyticsBeacon";

// El corazón de la tarjeta. El primer favorito se guarda en el navegador y se
// marca al instante — frenar el primer toque con un login pierde la visita. Al
// segundo aparece la invitación: ya demostró interés dos veces, y sin cuenta
// sus favoritos mueren con la pestaña. Al iniciar sesión, lo local se sube.
const LLAVE = `${activeBrand.key}_favoritos`;

const leer = (): string[] => {
  try { return JSON.parse(localStorage.getItem(LLAVE) ?? "[]"); } catch { return []; }
};
const escribir = (v: string[]) => localStorage.setItem(LLAVE, JSON.stringify(v));

// La sesión se lee del almacenamiento local de Supabase: cero red por tarjeta.
function conSesion(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  } catch { return false; }
}

export function Favorito({ slug, color }: { slug: string; color: string | null }) {
  const llave = `${slug}:${color ?? ""}`;
  const [marcado, setMarcado] = useState(false);
  const [modal, setModal] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMarcado(leer().includes(llave));
    // Con sesión: los del servidor mandan, y lo local pendiente se migra una vez.
    if (conSesion()) {
      const locales = leer();
      (locales.length
        ? migrarFavoritos(locales.map((l) => {
            const i = l.lastIndexOf(":");
            return { slug: l.slice(0, i), color: l.slice(i + 1) || null };
          })).then(() => escribir([]))
        : Promise.resolve()
      ).then(listarFavoritos).then((remotos) => setMarcado(remotos.includes(llave)));
    }
  }, [llave]);

  async function alternar(e: React.MouseEvent) {
    // Vive sobre el <Link> de la tarjeta: sin esto el toque navega al producto.
    e.preventDefault();
    e.stopPropagation();

    const local = leer();
    const yaEsta = local.includes(llave) || marcado;

    if (conSesion()) {
      setMarcado(!yaEsta); // optimista; la acción confirma
      const r = await alternarFavorito(slug, color);
      if (r.ok) setMarcado(r.marcado);
      return;
    }

    if (yaEsta) {
      escribir(local.filter((l) => l !== llave));
      setMarcado(false);
      return;
    }
    // Primer favorito: gratis. Segundo: la invitación a la cuenta.
    if (local.length >= 1) {
      setModal(true);
      trackCheckout("favorito_modal");
      return;
    }
    escribir([...local, llave]);
    setMarcado(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        aria-label={marcado ? "Quitar de favoritos" : "Guardar en favoritos"}
        aria-pressed={marcado}
        className="absolute right-2.5 bottom-2.5 z-10 grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-surface/85 shadow-[var(--shadow-sm)] backdrop-blur-sm transition-colors hover:bg-surface"
      >
        <motion.span
          key={String(marcado)}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className="inline-flex"
        >
          <Heart size={17} weight={marcado ? "fill" : "regular"} className={marcado ? "text-accent" : "text-text"} />
        </motion.span>
      </button>

      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModal(false); }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Guarda tus favoritos"
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-md)]"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <div className="mb-1 flex items-start justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Guarda tus favoritos</h2>
                <button onClick={() => setModal(false)} aria-label="Cerrar" className="rounded-full p-1.5 text-muted transition-colors hover:text-text">
                  <X size={16} />
                </button>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-muted">
                Crea tu cuenta para no perderlos — y llévate <strong className="text-accent">10% en tu primera compra</strong>.
              </p>
              <GoogleSignInButton next={pathname} label="Continuar con Google" />
              <a
                href={`/cuenta?next=${encodeURIComponent(pathname)}`}
                className="mt-3 block text-center text-xs text-muted underline-offset-2 hover:text-text hover:underline"
              >
                o con tu correo
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
