"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, CheckCircle, Camera, X } from "@phosphor-icons/react";
import { submitReview, subirFotoResena } from "@/app/resena/actions";
import { reducirImagen } from "@/lib/imagen-cliente";

type Fit = "" | "runs_small" | "true_to_size" | "runs_large";
const MAX_FOTOS = 3;

export function ReviewForm({
  token, productId, productName, detalle, imagen, publicada,
}: {
  token: string; productId: string; productName: string; detalle?: string; imagen?: string | null; publicada?: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [fit, setFit] = useState<Fit>("");
  const [body, setBody] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const cabecera = (
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {imagen && <img src={imagen} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0">
        <p className="font-medium capitalize">{productName}</p>
        {detalle && <p className="text-xs text-muted">{detalle}</p>}
      </div>
    </div>
  );

  if (publicada) {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        {cabecera}
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-[#2f9e5c] dark:text-[#5FD08A]">
          <CheckCircle size={16} weight="fill" /> Publicada
        </span>
      </div>
    );
  }

  async function agregar(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setSubiendo(true);
    try {
      for (const f of [...files].slice(0, MAX_FOTOS - fotos.length)) {
        const fd = new FormData();
        fd.set("foto", await reducirImagen(f));
        const res = await subirFotoResena(token, fd);
        if ("error" in res) throw new Error(res.error);
        setFotos((prev) => [...prev, res.url]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {cabecera}

      <div role="radiogroup" aria-label="Calificación" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
            className="flex h-11 w-11 items-center justify-center text-[#d9a53b] dark:text-[#E8B84A]"
          >
            <Star size={30} weight={n <= (hover || rating) ? "fill" : "regular"} />
          </button>
        ))}
      </div>

      <div role="group" aria-label="¿Cómo te quedó la talla?" className="flex flex-wrap gap-2">
        {([["runs_small", "Talla chica"], ["true_to_size", "Talla correcta"], ["runs_large", "Talla grande"]] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            aria-pressed={fit === val}
            onClick={() => setFit(fit === val ? "" : val)}
            className={`h-9 rounded-full border px-3.5 text-sm transition-colors ${
              fit === val ? "border-accent bg-accent-soft text-text" : "border-border text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="block space-y-1.5 text-sm text-muted">
        Tu opinión
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="¿Cómo se sienten, cómo te quedó el color, qué tal la entrega?"
          className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-text"
        />
      </label>

      {fotos.length > 0 && (
        <div className="flex gap-2">
          {fotos.map((u) => (
            <div key={u} className="relative h-20 w-20 overflow-hidden rounded-xl bg-elevated">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="Tu foto" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setFotos((p) => p.filter((x) => x !== u))}
                aria-label="Quitar foto"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}
      {fotos.length < MAX_FOTOS && (
        <>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => agregar(e.target.files)} />
          <button
            type="button"
            disabled={subiendo}
            onClick={() => input.current?.click()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted transition-colors hover:text-text disabled:opacity-60"
          >
            <Camera size={18} /> {subiendo ? "Subiendo…" : fotos.length ? "Agregar otra foto" : "Agrega una foto (opcional)"}
          </button>
        </>
      )}

      {error && <p className="text-sm text-accent">{error}</p>}

      <button
        disabled={rating === 0 || isPending || subiendo}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await submitReview({ token, productId, rating, body, fit, fotos });
            if ("error" in res) setError(res.error);
            else router.refresh();
          })
        }
        className="h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-contrast disabled:bg-border disabled:text-muted"
      >
        {isPending ? "Publicando…" : rating === 0 ? "Elige tus estrellas" : "Publicar reseña"}
      </button>
    </div>
  );
}
