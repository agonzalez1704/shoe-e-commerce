"use client";

import { useRef, useState } from "react";
import { UploadSimple, Spinner } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { saveRefineLogoUrl } from "@/app/admin/settings-actions";

const BUCKET = "product-images";

// Upload the brand logo used by auto-toon logo correction. Use a full logo
// (mark + wordmark) on a transparent background for best placement.
export function LogoSettings({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `brand/logo-${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await saveRefineLogoUrl(data.publicUrl);
      setUrl(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir el logo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold">Logo para corrección con IA</h2>
      <p className="mt-1 text-sm text-muted">
        Se aplica cuando usas &ldquo;Corregir logo&rdquo; en una imagen. Usa el logo completo (símbolo + letras),
        idealmente PNG o SVG con fondo transparente.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <div
          className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-border"
          style={{
            backgroundColor: "#fff",
            backgroundImage:
              "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
            backgroundSize: "12px 12px",
            backgroundPosition: "0 0,0 6px,6px -6px,-6px 0",
          }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
          ) : (
            <span className="px-2 text-center text-[11px] text-muted">Sin logo</span>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent-soft disabled:opacity-60"
          >
            {busy ? <Spinner size={16} className="animate-spin" /> : <UploadSimple size={16} />}
            {url ? "Reemplazar logo" : "Subir logo"}
          </button>
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml,image/webp"
        onChange={(e) => onFile(e.target.files)}
        className="hidden"
      />
    </section>
  );
}
