"use client";

import { useRef, useState } from "react";
import { UploadSimple, X, Spinner } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { ProductImageInput } from "@/app/admin/product-actions";

const BUCKET = "product-images";

export function ImageUploader({
  images,
  colors,
  onChange,
}: {
  images: ProductImageInput[];
  colors: string[];
  onChange: (images: ProductImageInput[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((img, i) => (
          <div key={img.url} className="space-y-1.5">
            <div className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-elevated">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                aria-label="Quitar imagen"
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-bg/80 text-text opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
              >
                <X size={13} weight="bold" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-1 left-1 rounded-full bg-bg/80 px-2 py-0.5 text-[10px] text-muted backdrop-blur">
                  portada
                </span>
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
      {error && <p className="text-sm text-accent">{error}</p>}
      <p className="text-xs text-muted">
        Asigna cada imagen a un color (o General). La primera es la portada. JPG/PNG/WebP/AVIF · máx 5MB.
      </p>
    </div>
  );
}
