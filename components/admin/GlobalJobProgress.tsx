"use client";

import Link from "next/link";
import { CheckCircle, WarningCircle, Spinner, X, MagicWand } from "@phosphor-icons/react";
import { useAngleJobList, useAngleJobsStore, type AngleJob } from "@/lib/stores/angle-jobs";

// Global, app-wide progress for async auto-toon jobs. Reads only the store, so
// it's agnostic of how jobs are produced (OCP): a top indeterminate bar while
// anything is processing + a stack of status toasts.
export function GlobalJobProgress() {
  const jobs = useAngleJobList();
  const remove = useAngleJobsStore((s) => s.remove);

  const processing = jobs.some((j) => j.status === "processing");

  return (
    <>
      {processing && (
        <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-accent-soft">
          <div className="ajp-bar h-full w-1/3 bg-accent" />
        </div>
      )}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {jobs.map((job) => (
          <Toast key={job.id} job={job} onClose={() => remove(job.id)} />
        ))}
      </div>
    </>
  );
}

function Toast({ job, onClose }: { job: AngleJob; onClose: () => void }) {
  const name = job.productName || "producto";
  return (
    <div className="pointer-events-auto overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-md)]">
      <div className="flex items-start gap-3 p-3.5">
        <Icon status={job.status} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">
            {job.status === "processing" && `Generando ángulos de ${name}…`}
            {job.status === "ready" && `Ángulos listos · ${name}`}
            {job.status === "failed" && `No se pudo generar · ${name}`}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {job.status === "processing" && "IA en proceso (~8 min). Puedes seguir trabajando."}
            {job.status === "ready" && `${job.resultUrls.length} imágenes agregadas.`}
            {job.status === "failed" && (job.error ?? "Intenta de nuevo.")}
          </p>

          {job.status === "ready" && job.resultUrls.length > 0 && (
            <div className="mt-2 flex gap-1.5">
              {job.resultUrls.slice(0, 4).map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" className="h-10 w-10 rounded-md border border-border object-cover" />
              ))}
            </div>
          )}
          {job.status === "ready" && job.productId && (
            <Link
              href={`/admin/products/${job.productId}/edit`}
              className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
            >
              Ver producto →
            </Link>
          )}
        </div>
        {job.status !== "processing" && (
          <button onClick={onClose} aria-label="Cerrar" className="text-muted transition-colors hover:text-text">
            <X size={15} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}

function Icon({ status }: { status: AngleJob["status"] }) {
  if (status === "ready") return <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" />;
  if (status === "failed") return <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-accent" />;
  return (
    <span className="relative mt-0.5 shrink-0 text-accent">
      <Spinner size={20} className="animate-spin" />
      <MagicWand size={10} weight="fill" className="absolute inset-0 m-auto" />
    </span>
  );
}
