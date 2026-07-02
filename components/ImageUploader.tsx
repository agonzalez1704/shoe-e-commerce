"use client";

import { useEffect, useRef, useState } from "react";
import { UploadSimple, X, Spinner, MagicWand, Stamp, Star, DotsSixVertical } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { ProductImageInput } from "@/app/admin/product-actions";
import { startAngleJob, refineImageLogo } from "@/app/admin/angle-actions";
import { useAngleJob, useAngleJobsStore } from "@/lib/stores/angle-jobs";

const BUCKET = "product-images";

export function ImageUploader({
  images,
  colors,
  productName,
  productId,
  onChange,
}: {
  images: ProductImageInput[];
  colors: string[];
  productName: string;
  productId?: string;
  onChange: (images: ProductImageInput[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // this uploader's in-flight job (started here); status comes from the global
  // store, fed by Realtime -> the webhook. No polling.
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useAngleJob(jobId ?? undefined);
  const seed = useAngleJobsStore((s) => s.upsert);
  const generating = job?.status === "processing";

  // keep the freshest images/colors for the completion callback
  const latest = useRef({ images, colors });
  latest.current = { images, colors };
  const consumedRef = useRef(false);

  // when our job completes, fold the generated angles into the form (once)
  useEffect(() => {
    if (!job) return;
    if (job.status === "ready" && job.resultUrls.length && !consumedRef.current) {
      consumedRef.current = true;
      const { images: imgs, colors: cols } = latest.current;
      onChange([...imgs, ...job.resultUrls.map((url) => ({ url, color: cols[0] ?? null }))]);
      setJobId(null);
    } else if (job.status === "failed") {
      setError(job.error ?? "No se pudieron generar los ángulos.");
      setJobId(null);
    }
  }, [job, onChange]);

  async function generateAngles() {
    const source = images[0]?.url;
    if (!source) return;
    setError(null);
    consumedRef.current = false;
    const res = await startAngleJob(source, productName, productId);
    if ("error" in res) { setError(res.error); return; }
    setJobId(res.jobId);
    // reflect immediately in the global bar/toast
    seed({ id: res.jobId, productId: productId ?? null, productName, status: "processing", resultUrls: [], error: null });
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const uploaded: ProductImageInput[] = [];
    const defaultColor = colors[0] ?? null;

    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) throw new Error(upErr.message);
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        uploaded.push({ url: data.publicUrl, color: defaultColor });
      }
      onChange([...images, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function setColor(i: number, color: string | null) {
    onChange(images.map((img, idx) => (idx === i ? { ...img, color } : img)));
  }

  // reorder: array order == carousel order, index 0 == portada
  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= images.length) return;
    const next = [...images];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  }
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // auto-toon logo correction on one image using the brand logo (~60-90s)
  const [refiningIdx, setRefiningIdx] = useState<number | null>(null);
  async function refineLogoAt(i: number) {
    setError(null);
    setRefiningIdx(i);
    try {
      const res = await refineImageLogo(images[i].url);
      if ("error" in res) setError(res.error);
      else onChange(images.map((img, idx) => (idx === i ? { ...img, url: res.url } : img)));
    } finally {
      setRefiningIdx(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((img, i) => (
          <div key={img.url} className="space-y-1.5">
            <div
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragEnter={() => {
                if (dragIdx === null || dragIdx === i) return;
                move(dragIdx, i);
                setDragIdx(i);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={() => setDragIdx(null)}
              className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl border bg-elevated active:cursor-grabbing ${
                dragIdx === i ? "border-accent opacity-60" : "border-border"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" draggable={false} className="h-full w-full object-cover" />
              <span className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-text/40 opacity-0 transition-opacity group-hover:opacity-100">
                <DotsSixVertical size={16} weight="bold" />
              </span>
              <button
                type="button"
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                aria-label="Quitar imagen"
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-bg/80 text-text opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
              >
                <X size={13} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => refineLogoAt(i)}
                disabled={refiningIdx !== null}
                aria-label="Corregir logo con IA"
                title="Corregir logo con IA (auto-toon)"
                className={`absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-bg/80 text-accent backdrop-blur transition-opacity disabled:opacity-100 ${
                  refiningIdx === i ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {refiningIdx === i ? <Spinner size={12} className="animate-spin" /> : <Stamp size={13} weight="bold" />}
              </button>
              {i === 0 ? (
                <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-accent/90 px-2 py-0.5 text-[10px] font-medium text-accent-contrast backdrop-blur">
                  <Star size={10} weight="fill" /> portada
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => move(i, 0)}
                  title="Hacer portada"
                  className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 text-[10px] text-muted opacity-0 backdrop-blur transition-opacity hover:text-text group-hover:opacity-100"
                >
                  <Star size={10} /> portada
                </button>
              )}
            </div>
            <select
              value={img.color ?? ""}
              onChange={(e) => setColor(i, e.target.value || null)}
              className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs capitalize outline-none focus:border-text"
            >
              <option value="">General</option>
              {colors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="grid aspect-square place-items-center self-start rounded-xl border border-dashed border-border text-muted transition-colors hover:border-text hover:text-text"
        >
          {uploading ? <Spinner size={22} className="animate-spin" /> : <UploadSimple size={22} />}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      {images.length > 0 && (
        <button
          type="button"
          onClick={generateAngles}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-full border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent-soft disabled:opacity-60"
        >
          {generating ? <Spinner size={16} className="animate-spin" /> : <MagicWand size={16} weight="bold" />}
          {generating ? "Generando ángulos…" : "Generar ángulos con IA"}
        </button>
      )}

      {error && <p className="text-sm text-accent">{error}</p>}
      <p className="text-xs text-muted">
        Asigna cada imagen a un color (o General). La primera es la portada. JPG/PNG/WebP/AVIF · máx 5MB.
        Genera más ángulos a partir de la primera imagen con IA (auto-toon).
      </p>
    </div>
  );
}
