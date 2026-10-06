"use client";

import { useState, useTransition } from "react";
import { Star, CheckCircle } from "@phosphor-icons/react";
import { submitReview } from "@/app/resena/actions";

type Fit = "" | "runs_small" | "true_to_size" | "runs_large";

export function ReviewForm({ token, productId, productName }: { token: string; productId: string; productName: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [fit, setFit] = useState<Fit>("");
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [cupon, setCupon] = useState<{ codigo: string; porcentaje: number; dias: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-elevated p-4 text-sm">
        <p className="flex items-center gap-2">
          <CheckCircle size={20} weight="fill" className="text-accent" /> ¡Gracias por tu reseña de {productName}!
        </p>
        {cupon && (
          <p className="mt-3 text-muted">
            Tu {cupon.porcentaje}% para el siguiente par (se suma al combo):{" "}
            <strong className="select-all tracking-wider text-text">{cupon.codigo}</strong>. Un uso, válido {cupon.dias} días; también
            te lo mandamos por correo.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border p-5">
      <p className="font-medium">{productName}</p>

      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} estrellas`}
            className="text-accent"
          >
            <Star size={26} weight={n <= (hover || rating) ? "fill" : "regular"} />
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {([["runs_small", "Talla chica"], ["true_to_size", "Talla correcta"], ["runs_large", "Talla grande"]] as const).map(
          ([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFit(fit === val ? "" : val)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                fit === val ? "border-accent text-accent" : "border-border text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Cuéntanos qué te parecieron (opcional)"
        className="mt-4 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-text"
      />

      {error && <p className="mt-2 text-sm text-accent">{error}</p>}

      <button
        disabled={rating === 0 || isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await submitReview({ token, productId, rating, body, fit });
            if ("error" in res) setError(res.error);
            else {
              setCupon(res.cupon);
              setDone(true);
            }
          })
        }
        className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-contrast disabled:bg-border disabled:text-muted"
      >
        {isPending ? "Enviando…" : "Enviar reseña"}
      </button>
    </div>
  );
}
