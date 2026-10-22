"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogPopup, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { aprobarFoto, rechazarFoto, responderResena, quitarFotoResena } from "@/app/admin/resenas/actions";

const MOTIVOS = ["No encontramos la etiqueta a la marca", "La publicación no es visible (cuenta privada)", "No aparecen los zapatos"];

export function RevisarFoto({ orderId, cartera }: { orderId: string; cartera: boolean }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const correr = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
    });

  return (
    <div className="space-y-2">
      {rechazando ? (
        <div className="space-y-2">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-bg px-2 text-sm">
            {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <div className="flex gap-2">
            <button disabled={isPending} onClick={() => correr(() => rechazarFoto(orderId, motivo))} className="h-10 flex-1 rounded-lg bg-accent px-3 text-sm font-medium text-accent-contrast disabled:opacity-60">
              {isPending ? "Enviando…" : "Rechazar y avisarle"}
            </button>
            <button onClick={() => setRechazando(false)} className="h-10 rounded-lg border border-border px-3 text-sm text-muted">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button disabled={isPending} onClick={() => correr(() => aprobarFoto(orderId))} className="h-10 flex-1 rounded-lg bg-[#2f9e5c] px-3 text-sm font-medium text-white disabled:opacity-60">
            {isPending ? "Aprobando…" : cartera ? "Aprobar y enviar cartera" : "Aprobar y enviar 10%"}
          </button>
          <button onClick={() => setRechazando(true)} className="h-10 rounded-lg border border-border px-3 text-sm text-muted hover:text-text">Rechazar</button>
        </div>
      )}
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}

export function ResponderResena({ reviewId, inicial }: { reviewId: string; inicial: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(inicial ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="text-xs font-medium text-accent">
        {inicial ? "Editar respuesta" : "Responder"}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="Respuesta de la tienda (se publica bajo la reseña)"
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-text"
      />
      <div className="flex items-center gap-2">
        <button
          disabled={isPending}
          onClick={() =>
            start(async () => {
              const r = await responderResena(reviewId, texto);
              setMsg(r.ok ? "Publicada ✓" : r.error);
              if (r.ok) setAbierto(false);
            })
          }
          className="h-9 rounded-lg bg-text px-3 text-xs font-medium text-bg disabled:opacity-60"
        >
          {isPending ? "Guardando…" : texto.trim() ? "Publicar respuesta" : "Quitar respuesta"}
        </button>
        <button onClick={() => setAbierto(false)} className="h-9 px-2 text-xs text-muted">Cancelar</button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </div>
  );
}

export function QuitarFoto({ reviewId, url }: { reviewId: string; url: string }) {
  const [isPending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={isPending}
        className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white disabled:opacity-60"
      >
        {isPending ? "…" : "Quitar"}
      </AlertDialogTrigger>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Quitar esta foto?</AlertDialogTitle>
          <AlertDialogDescription>Deja de mostrarse en la ficha del producto. La reseña se queda.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-text">Conservarla</AlertDialogClose>
          <AlertDialogClose
            onClick={() => start(async () => { await quitarFotoResena(reviewId, url); })}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast"
          >
            Sí, quitarla
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
