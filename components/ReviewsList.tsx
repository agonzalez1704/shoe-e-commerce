"use client";

import { useState } from "react";
import { Stars } from "@/components/Stars";
import { FIT_LABEL, type Review } from "@/lib/reviews-shared";

const PAGINA = 5;
const FIT_TONO: Record<string, string> = {
  runs_small: "text-[#b7861f] dark:text-[#E8B84A]",
  true_to_size: "text-[#2f9e5c] dark:text-[#5FD08A]",
  runs_large: "text-[#b7861f] dark:text-[#E8B84A]",
};

const hace = (iso: string) => {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (dias < 1) return "hoy";
  if (dias < 7) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  if (dias < 30) return `hace ${Math.floor(dias / 7)} ${dias < 14 ? "semana" : "semanas"}`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
};

// Filtros (todas / con foto / por color) y "ver todas": estado de la vista,
// sin ir al servidor — una ficha no junta tantas reseñas.
export function ReviewsList({ items }: { items: Review[] }) {
  const colores = [...new Set(items.map((r) => r.color).filter((c): c is string => !!c))];
  const conFoto = items.some((r) => r.fotos?.length);
  const [filtro, setFiltro] = useState<string>("todas");
  const [todas, setTodas] = useState(false);

  const visibles = items.filter((r) =>
    filtro === "todas" ? true : filtro === "foto" ? r.fotos?.length > 0 : r.color === filtro,
  );
  const mostradas = todas ? visibles : visibles.slice(0, PAGINA);
  const opciones = [
    { id: "todas", label: "Todas" },
    ...(conFoto ? [{ id: "foto", label: "Con foto" }] : []),
    ...(colores.length > 1 ? colores.map((c) => ({ id: c, label: c[0].toUpperCase() + c.slice(1) })) : []),
  ];

  return (
    <div className="space-y-5">
      {opciones.length > 1 && (
        <div role="group" aria-label="Filtrar reseñas" className="flex flex-wrap gap-2">
          {opciones.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={filtro === o.id}
              onClick={() => { setFiltro(o.id); setTodas(false); }}
              className={`h-9 rounded-full border px-4 text-sm transition-colors ${
                filtro === o.id ? "border-text bg-text font-medium text-bg" : "border-border text-muted hover:text-text"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <ul className="divide-y divide-border border-t border-border">
        {mostradas.map((r) => (
          <li key={r.id} className="grid gap-3 py-5 md:grid-cols-[170px_minmax(0,1fr)] md:gap-7">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:flex-col md:items-start">
              <span className="text-sm font-medium">{r.autor ?? "Cliente"}</span>
              {r.ciudad && <span className="text-xs text-muted">{r.ciudad}</span>}
              {r.verified_purchase && (
                <span className="rounded-full bg-[#5FD08A]/15 px-2 py-0.5 text-[11px] text-[#2f9e5c] dark:text-[#5FD08A]">
                  ✓ Compra verificada
                </span>
              )}
              {(r.color || r.talla) && (
                <span className="text-xs text-muted md:mt-1">
                  {[r.color && r.color[0].toUpperCase() + r.color.slice(1), r.talla && `talla ${r.talla}`].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <Stars value={r.rating} />
                  {r.fit_feedback && <span className={`text-xs ${FIT_TONO[r.fit_feedback]}`}>{FIT_LABEL[r.fit_feedback]}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{hace(r.created_at)}</span>
              </div>
              {r.body && <p className="text-sm leading-relaxed text-text/85">{r.body}</p>}
              {r.fotos?.length > 0 && (
                <div className="flex gap-2">
                  {r.fotos.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block h-24 w-24 overflow-hidden rounded-xl bg-elevated">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="Foto del cliente" loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {r.respuesta && (
                <div className="space-y-1 rounded-r-xl border-l-2 border-accent bg-surface px-3.5 py-3">
                  <p className="text-xs font-medium">Respuesta de Blade</p>
                  <p className="text-sm text-muted">{r.respuesta}</p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!todas && visibles.length > PAGINA && (
        <button
          type="button"
          onClick={() => setTodas(true)}
          className="h-11 rounded-full border border-border px-6 text-sm transition-colors hover:bg-surface"
        >
          Ver las {visibles.length} reseñas
        </button>
      )}
    </div>
  );
}
