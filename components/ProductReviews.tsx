import { Stars } from "@/components/Stars";
import { FIT_LABEL, type ReviewSummary } from "@/lib/reviews";

export function ProductReviews({ summary }: { summary: ReviewSummary }) {
  return (
    <section className="mt-16 border-t border-border pt-10">
      <div className="flex items-baseline gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Reseñas</h2>
        {summary.count > 0 && (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Stars value={summary.average} />
            <span className="nums">{summary.average.toFixed(1)} · {summary.count}</span>
          </span>
        )}
      </div>

      {summary.count === 0 ? (
        <p className="mt-4 text-sm text-muted">Aún no hay reseñas. Sé el primero en opinar tras tu compra.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {summary.items.map((r, i) => (
            <li key={i} className="border-b border-border pb-6 last:border-0">
              <div className="flex flex-wrap items-center gap-3">
                <Stars value={r.rating} />
                {r.verified_purchase && (
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                    Compra verificada
                  </span>
                )}
                {r.fit_feedback && (
                  <span className="text-xs text-muted">{FIT_LABEL[r.fit_feedback]}</span>
                )}
                <span className="ml-auto text-xs text-muted">
                  {new Date(r.created_at).toLocaleDateString("es-MX")}
                </span>
              </div>
              {r.body && <p className="mt-2 text-sm leading-relaxed text-muted">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
