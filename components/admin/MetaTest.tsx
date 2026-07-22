"use client";

import { useState, useTransition } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { sendMetaTestEvent } from "@/app/admin/meta-actions";

export function MetaTest() {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const code = (form.elements.namedItem("code") as HTMLInputElement).value;
    startTransition(async () => {
      setMsg(null);
      setErr(null);
      const r = await sendMetaTestEvent(code);
      if (r.ok) setMsg(`Enviado. Meta respondió: ${r.detail}`);
      else setErr(r.error);
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <div>
        <h2 className="text-sm font-semibold">Probar API de Conversiones (Meta)</h2>
        <p className="mt-0.5 text-xs text-muted">
          Manda un <span className="font-medium">Purchase</span> de prueba desde el servidor. Pega el{" "}
          <span className="nums">test_event_code</span> de Events Manager → Probar eventos y deja esa pestaña abierta.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          name="code"
          required
          placeholder="TEST58118"
          className="nums h-10 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-accent"
        />
        <button
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-50"
        >
          <PaperPlaneTilt size={15} weight="bold" /> {isPending ? "Enviando…" : "Enviar prueba"}
        </button>
      </form>

      {msg && <p className="break-all text-xs text-accent">{msg}</p>}
      {err && <p className="break-all rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">{err}</p>}
    </div>
  );
}
