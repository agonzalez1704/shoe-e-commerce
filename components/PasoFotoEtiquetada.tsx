"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, X } from "@phosphor-icons/react";
import { enviarFotoEtiquetada } from "@/app/resena/actions";
import { reducirImagen } from "@/lib/imagen-cliente";

// Paso 2: enlace a la publicación (posts, reels) o captura (historias).
export function PasoFotoEtiquetada({ token }: { token: string }) {
  const router = useRouter();
  const [enlace, setEnlace] = useState("");
  const [captura, setCaptura] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          try {
            const fd = new FormData();
            fd.set("enlace", enlace);
            if (captura) fd.set("captura", await reducirImagen(captura));
            const res = await enviarFotoEtiquetada(token, fd);
            if ("error" in res) setError(res.error);
            else router.refresh();
          } catch {
            setError("No se pudo procesar la captura. Prueba con otra imagen.");
          }
        });
      }}
    >
      <label className="block space-y-1.5 text-sm text-muted">
        Enlace de tu publicación
        <input
          type="url"
          inputMode="url"
          value={enlace}
          onChange={(e) => setEnlace(e.target.value)}
          placeholder="https://instagram.com/p/…"
          className="h-12 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text outline-none focus:border-text"
        />
      </label>

      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => setCaptura(e.target.files?.[0] ?? null)} />
      {captura ? (
        <div className="flex h-12 items-center justify-between gap-2 rounded-xl border border-border px-3 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-muted">
            <ImageIcon size={18} /> <span className="truncate">{captura.name}</span>
          </span>
          <button type="button" onClick={() => setCaptura(null)} aria-label="Quitar captura" className="flex h-8 w-8 items-center justify-center text-muted">
            <X size={14} weight="bold" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted transition-colors hover:text-text"
        >
          <ImageIcon size={18} /> o sube una captura (para historias)
        </button>
      )}

      {error && <p className="text-sm text-accent">{error}</p>}

      <button
        disabled={isPending || (!enlace.trim() && !captura)}
        className="h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-contrast disabled:bg-border disabled:text-muted"
      >
        {isPending ? "Enviando…" : "Enviar y desbloquear mi 10%"}
      </button>
    </form>
  );
}
