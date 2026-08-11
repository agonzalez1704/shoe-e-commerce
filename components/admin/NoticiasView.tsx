"use client";

import { useState, useTransition } from "react";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { guardarNoticia, eliminarNoticia } from "@/app/admin/noticias-actions";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string; slug: string; titulo: string; categoria: string | null;
  cover_url: string | null; cuerpo: string | null; published_at: string | null;
};

const INPUT = "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text";
const vacia = () => ({ id: undefined as string | undefined, slug: "", titulo: "", categoria: "", coverUrl: "", cuerpo: "", publicada: false });

export function NoticiasView({ noticias }: { noticias: Row[] }) {
  const [form, setForm] = useState<ReturnType<typeof vacia> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const editar = (n: Row) => {
    setError(null);
    setForm({
      id: n.id, slug: n.slug, titulo: n.titulo, categoria: n.categoria ?? "",
      coverUrl: n.cover_url ?? "", cuerpo: n.cuerpo ?? "", publicada: !!n.published_at,
    });
  };

  const guardar = () => {
    if (!form) return;
    setError(null);
    start(async () => {
      const r = await guardarNoticia(form);
      if (r.ok) setForm(null);
      else setError(r.error ?? "No se pudo guardar");
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Noticias y eventos</h1>
        <button onClick={() => { setError(null); setForm(vacia()); }} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast">
          <Plus size={14} weight="bold" /> Nueva
        </button>
      </div>

      {form && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          {error && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted md:col-span-2">
              Título
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={`${INPUT} w-full`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Slug <span className="text-[11px]">(vacío = se deriva del título)</span>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="apertura-sucursal-leon" className={`${INPUT} w-full`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Categoría
              <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Evento" className={`${INPUT} w-full`} />
            </label>
            <div className="md:col-span-2">
              <p className="mb-1 text-xs text-muted">Portada</p>
              <CoverInput url={form.coverUrl} onChange={(url) => setForm({ ...form, coverUrl: url })} />
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted md:col-span-2">
              Cuerpo <span className="text-[11px]">(texto plano; una línea en blanco separa párrafos)</span>
              <textarea value={form.cuerpo} onChange={(e) => setForm({ ...form, cuerpo: e.target.value })} rows={6} className={`${INPUT} w-full`} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.publicada} onChange={(e) => setForm({ ...form, publicada: e.target.checked })} className="accent-[var(--accent)]" />
            Publicada <span className="text-xs text-muted">(sin marcar queda como borrador y no se ve en la tienda)</span>
          </label>
          <div className="flex gap-2">
            <button onClick={guardar} disabled={isPending} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60">
              {isPending ? "Guardando…" : "Guardar"}
            </button>
            <button onClick={() => setForm(null)} className="rounded-full border border-border px-5 py-2 text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {noticias.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          Todavía no hay noticias. La sección no aparece en la tienda hasta que publiques la primera.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {noticias.map((n) => (
            <li key={n.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{n.titulo}</p>
                <p className="text-xs text-muted">
                  {n.published_at ? new Date(n.published_at).toLocaleDateString("es-MX") : "Borrador"}
                  {n.categoria ? ` · ${n.categoria}` : ""} · /{n.slug}
                </p>
              </div>
              <button onClick={() => editar(n)} aria-label="Editar" className="rounded-lg p-2 text-muted hover:text-text"><PencilSimple size={16} /></button>
              <button
                onClick={() => start(async () => { const r = await eliminarNoticia(n.id); if (!r.ok) setError(r.error ?? "No se pudo eliminar"); })}
                aria-label="Eliminar" className="rounded-lg p-2 text-muted hover:text-accent"><Trash size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Subida mínima al mismo bucket, bajo el prefijo noticias/. No se reusa
// ImageUploader: ese componente está acoplado a la generación de ángulos por IA
// de un producto y arrastraría todo ese flujo a un formulario de noticias.
function CoverInput({ url, onChange }: { url: string; onChange: (url: string) => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function subir(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setErr(null);
    setSubiendo(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `noticias/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600" });
      if (error) throw new Error(error.message);
      onChange(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="space-y-2">
      {url && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-20 w-32 rounded-lg object-cover ring-1 ring-border" />
          <button onClick={() => onChange("")} className="text-xs text-accent">Quitar</button>
        </div>
      )}
      <input type="file" accept="image/*" disabled={subiendo} onChange={(e) => subir(e.target.files)} className="block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-xs file:text-text" />
      {subiendo && <p className="text-xs text-muted">Subiendo…</p>}
      {err && <p className="text-xs text-accent">{err}</p>}
    </div>
  );
}
