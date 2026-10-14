import { Stars } from "@/components/Stars";
import { ReviewsList } from "@/components/ReviewsList";
import { FIT_MINIMO, type ReviewSummary } from "@/lib/reviews";

// Reseñas publicas de la ficha: resumen (promedio, estrellas, talla, fotos) a
// la izquierda y la lista filtrable a la derecha. Solo hay reseñas de pedidos
// entregados (lo valida /resena), de ahi "compras verificadas".
export function ProductReviews({ summary }: { summary: ReviewSummary }) {
  const { count, average, porEstrella, fit, fotos } = summary;
  const max = Math.max(1, ...porEstrella);

  return (
    <section id="resenas" className="mt-16 scroll-mt-24 border-t border-border pt-10">
      <div className="grid gap-10 md:grid-cols-[300px_minmax(0,1fr)] md:gap-14">
        <aside className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Reseñas</h2>

          {count === 0 ? (
            <p className="text-sm text-muted">Aún no hay reseñas. Sé el primero en opinar tras recibir tu pedido.</p>
          ) : (
            <>
              <div className="flex items-center gap-5">
                <div className="flex flex-col items-start gap-1">
                  <span className="nums text-5xl font-semibold leading-none">{average.toFixed(1)}</span>
                  <Stars value={average} size={16} />
                  <span className="text-xs text-muted">
                    {count} {count === 1 ? "reseña" : "reseñas"} de compras verificadas
                  </span>
                </div>
              </div>

              <ul className="space-y-1.5 text-xs text-muted" aria-label="Reseñas por calificación">
                {porEstrella.map((n, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <span className="w-8">{5 - i} ★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                      <span className="block h-full rounded-full bg-[#E8B84A]" style={{ width: `${(n / max) * 100}%` }} />
                    </span>
                    <span className="nums w-6 text-right">{n}</span>
                  </li>
                ))}
              </ul>

              {fit.total >= FIT_MINIMO && (
                <div className="space-y-2.5 rounded-2xl border border-border bg-surface p-4">
                  <p className="text-sm font-medium">¿Cómo queda la talla?</p>
                  <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                    <span className="bg-elevated" style={{ flex: fit.chica || 0.0001 }} />
                    <span className="bg-[#5FD08A]" style={{ flex: fit.correcta || 0.0001 }} />
                    <span className="bg-elevated" style={{ flex: fit.grande || 0.0001 }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted">
                    <span>Chica {fit.chica}%</span>
                    <span className="font-semibold text-[#2f9e5c] dark:text-[#5FD08A]">Correcta {fit.correcta}%</span>
                    <span>Grande {fit.grande}%</span>
                  </div>
                </div>
              )}

              {fotos.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-sm font-medium">Fotos de clientes</p>
                  <div className="grid grid-cols-3 gap-2">
                    {fotos.slice(0, fotos.length > 3 ? 2 : 3).map((src) => (
                      <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-elevated">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="Foto de cliente" loading="lazy" className="h-full w-full object-cover" />
                      </a>
                    ))}
                    {fotos.length > 3 && (
                      <span className="flex aspect-square items-center justify-center rounded-xl bg-elevated text-sm text-muted">
                        +{fotos.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <a href="/resena" className="inline-block text-sm text-muted underline-offset-2 hover:text-text hover:underline">
            ¿Ya te llegó? Deja tu reseña
          </a>
        </aside>

        {count > 0 && (
          <div className="min-w-0 space-y-5">
            <ReviewsList items={summary.items} />
            <p className="text-xs leading-relaxed text-muted">
              Solo publican reseña quienes compraron y recibieron su pedido. Quienes reseñan reciben un cupón, sin
              importar su calificación.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
