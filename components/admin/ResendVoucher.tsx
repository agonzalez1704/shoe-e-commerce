"use client";

import { useState, useTransition } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { resendPaymentInstructions } from "@/app/admin/actions";

// Re-sends the cash/SPEI voucher to the buyer. Shown only while the order is
// still pending, since the email is useless once it's paid.
export function ResendVoucher({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function send() {
    startTransition(async () => {
      setMsg(null);
      setErr(null);
      try {
        const r = await resendPaymentInstructions(orderId);
        setMsg(`Instrucciones enviadas a ${r.sentTo}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "No se pudo enviar");
      }
    });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        disabled={isPending}
        onClick={send}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-medium transition-colors hover:bg-elevated disabled:opacity-50"
      >
        <EnvelopeSimple size={14} weight="bold" />
        {isPending ? "Enviando…" : "Reenviar instrucciones de pago"}
      </button>
      {msg && <p className="mt-2 text-xs text-accent">{msg}</p>}
      {err && <p className="mt-2 text-xs text-accent">{err}</p>}
    </div>
  );
}
