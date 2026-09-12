"use client";

import Script from "next/script";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { activeBrand } from "@/lib/brand";
import { pagarComplemento, type ResultadoCobro } from "@/app/pedido/[orderNumber]/combo/cobro";

// Paso 2 del combo exprés: pagar la diferencia con TODOS los métodos del
// checkout — tarjeta, efectivo en establecimientos, Aplazo y Mercado Pago.

type Metodo = "card" | "oxxo" | "aplazo" | "mercadopago";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const IN = "h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text outline-none focus:border-accent";

export function PagoComplemento({ parentOrderNumber, token, childOrderNumber, totalCents, conektaPublicKey, mpEnabled }: {
  parentOrderNumber: string;
  token: string | null;
  childOrderNumber: string;
  totalCents: number;
  conektaPublicKey: string;
  mpEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [metodo, setMetodo] = useState<Metodo>("card");
  const [err, setErr] = useState<string | null>(null);
  const [listo, setListo] = useState<null | { paid: boolean; voucher?: { reference: string | null; barcodeUrl: string | null } }>(null);
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" });

  const metodos: { id: Metodo; label: string }[] = [
    { id: "card", label: "Tarjeta" },
    { id: "oxxo", label: "Paga en establecimientos" },
    ...(activeBrand.copy?.installments ? [{ id: "aplazo" as Metodo, label: activeBrand.copy.installments.provider }] : []),
    ...(mpEnabled ? [{ id: "mercadopago" as Metodo, label: "Mercado Pago" }] : []),
  ];

  function tokenizaTarjeta(): Promise<string> {
    return new Promise((resolve, reject) => {
      const C = window.Conekta;
      if (!C) return reject(new Error("El módulo de tarjeta no cargó. Recarga la página."));
      C.setPublicKey(conektaPublicKey);
      const [mm, yy] = card.expiry.split("/").map((s) => s.trim());
      C.Token.create(
        { card: { number: card.number.replace(/\s+/g, ""), name: card.name, exp_month: mm ?? "", exp_year: (yy ?? "").length === 2 ? `20${yy}` : yy ?? "", cvc: card.cvc } },
        (res) => resolve(res.id),
        (e) => reject(new Error(e.message_to_purchaser ?? e.message ?? "Tarjeta rechazada")),
      );
    });
  }

  const pagar = () => {
    if (metodo === "mercadopago") { window.location.href = `/pedido/${childOrderNumber}/pagar`; return; }
    startTransition(async () => {
      setErr(null);
      try {
        let tokenTarjeta: string | undefined;
        if (metodo === "card") tokenTarjeta = await tokenizaTarjeta();
        const r: ResultadoCobro = await pagarComplemento(parentOrderNumber, token, metodo, tokenTarjeta);
        if (!r.ok) { setErr(r.error); return; }
        if (!r.paid && r.redirectUrl) { window.location.href = r.redirectUrl; return; }
        setListo({ paid: r.paid, voucher: r.paid ? undefined : r.voucher });
        window.scrollTo({ top: 0 });
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "No se pudo procesar el pago");
      }
    });
  };

  if (listo) {
    return (
      <div className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-accent">
          <CheckCircle size={22} weight="fill" />
          <p className="font-semibold text-text">
            {listo.paid ? "¡Combo completo! Pago confirmado." : "Ficha generada — paga en tienda para confirmar tu par."}
          </p>
        </div>
        {listo.voucher && (
          <div className="rounded-xl bg-white p-4 text-center">
            {listo.voucher.barcodeUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listo.voucher.barcodeUrl} alt="Código de barras" className="mx-auto max-h-40 w-auto" />
            )}
            {listo.voucher.reference && <p className="mt-2 font-mono text-sm tracking-wider text-zinc-900">{listo.voucher.reference}</p>}
          </div>
        )}
        <p className="text-xs text-muted">Pedido {childOrderNumber} · {mxn(totalCents)}{listo.voucher ? " · también te lo enviamos por correo" : ""}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-border bg-surface p-5">
      <Script src="https://cdn.conekta.io/js/latest/conekta.js" strategy="afterInteractive" />
      <p className="text-sm">
        Tu par está apartado en el pedido <span className="nums font-medium">{childOrderNumber}</span>.
        Paga <span className="nums font-semibold text-accent">{mxn(totalCents)}</span> para confirmarlo:
      </p>
      <div className="flex flex-wrap gap-2">
        {metodos.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={metodo === m.id}
            onClick={() => { setMetodo(m.id); setErr(null); }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${metodo === m.id ? "bg-accent text-accent-contrast" : "border border-border text-muted hover:text-text"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {metodo === "card" && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))} inputMode="numeric" autoComplete="cc-number" placeholder="Número de tarjeta" className={`${IN} nums sm:col-span-2`} />
          <input value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} autoComplete="cc-name" placeholder="Nombre en la tarjeta" className={`${IN} sm:col-span-2`} />
          <input value={card.expiry} onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" className={`${IN} nums`} />
          <input value={card.cvc} onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))} inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" maxLength={4} className={`${IN} nums`} />
        </div>
      )}
      {metodo === "oxxo" && (
        <p className="text-xs text-muted">Te generamos una ficha con código de barras; pagas en efectivo en Farmacias del Ahorro, 7-Eleven, Walmart, BBVA y +20,000 tiendas. Detectamos tu pago automáticamente.</p>
      )}
      {metodo === "aplazo" && <p className="text-xs text-muted">Te llevamos a Aplazo para aprobar; al volver, tu par queda confirmado.</p>}
      {metodo === "mercadopago" && <p className="text-xs text-muted">Te llevamos a Mercado Pago — tarjeta o saldo, en una sola exhibición.</p>}

      {err && <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{err}</p>}
      <button
        disabled={isPending}
        onClick={pagar}
        className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "Procesando…" : `Pagar ${mxn(totalCents)}`}
      </button>
    </div>
  );
}
