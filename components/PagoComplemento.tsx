"use client";

import Script from "next/script";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Cards, { type Focused } from "react-credit-cards-2";
import "react-credit-cards-2/dist/es/styles-compiled.css";
import { CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { activeBrand } from "@/lib/brand";
import { MethodMark, StoreLogos, type Method } from "@/components/CheckoutForm";
import { pagarComplemento, type ResultadoCobro } from "@/app/pedido/[orderNumber]/combo/cobro";
import { cambiarPar } from "@/app/pedido/[orderNumber]/combo/actions";

// Paso 2 del combo exprés, con el MISMO lenguaje visual del checkout: chips de
// método con logos, preview de tarjeta y la nota de seguridad de Conekta.

type Metodo = Extract<Method, "card" | "oxxo" | "aplazo" | "mercadopago">;

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const CI = "h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/10";

export type ParElegido = { nombre: string; label: string; imagen: string | null };

export function PagoComplemento({ parentOrderNumber, token, childOrderNumber, totalCents, elegido, conektaPublicKey, mpEnabled, fichaGenerada }: {
  parentOrderNumber: string;
  token: string | null;
  childOrderNumber: string;
  totalCents: number;
  elegido: ParElegido | null;
  conektaPublicKey: string;
  mpEnabled: boolean;
  fichaGenerada: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [metodo, setMetodo] = useState<Metodo>("card");
  const [err, setErr] = useState<string | null>(null);
  const [listo, setListo] = useState<null | { paid: boolean; voucher?: { reference: string | null; barcodeUrl: string | null } }>(null);
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" });
  const [focus, setFocus] = useState<Focused | undefined>(undefined);

  const fmtNumber = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const fmtExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };
  const setCardField = (k: "number" | "name" | "expiry" | "cvc", v: string) => setCard((c) => ({ ...c, [k]: v }));

  const metodos: { id: Metodo; label: string; hint: string }[] = [
    { id: "card", label: "Tarjeta", hint: "Crédito o débito" },
    { id: "oxxo", label: "Paga en establecimientos", hint: "+20,000 tiendas" },
    ...(activeBrand.copy?.installments ? [{ id: "aplazo" as Metodo, label: activeBrand.copy.installments.provider, hint: "Págalo en quincenas" }] : []),
    ...(mpEnabled ? [{ id: "mercadopago" as Metodo, label: "Mercado Pago", hint: "Tarjeta o saldo" }] : []),
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

  const cambiar = () =>
    startTransition(async () => {
      setErr(null);
      const r = await cambiarPar(parentOrderNumber, token);
      if (r && !r.ok) setErr(r.error);
    });

  if (listo) {
    return (
      <div className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2 text-accent">
          <CheckCircle size={24} weight="fill" />
          <p className="text-lg font-semibold text-text">
            {listo.paid ? "¡Combo completo! Pago confirmado." : "Ficha generada"}
          </p>
        </div>
        {elegido && <p className="text-sm text-muted">{elegido.nombre} · <span className="capitalize">{elegido.label}</span></p>}
        {listo.voucher && (
          <>
            <p className="text-sm text-muted">Paga en efectivo mostrando este código en la caja de una tienda afiliada. <span className="font-medium text-text">No es válido en OXXO.</span></p>
            <div className="rounded-xl bg-white p-4 text-center">
              {listo.voucher.barcodeUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listo.voucher.barcodeUrl} alt="Código de barras para pago en efectivo" className="mx-auto max-h-44 w-auto" />
              )}
              {listo.voucher.reference && <p className="mt-2 font-mono text-sm tracking-wider text-zinc-900">{listo.voucher.reference}</p>}
            </div>
            <StoreLogos h={16} />
          </>
        )}
        <p className="nums text-sm">Pedido {childOrderNumber} · {mxn(totalCents)}</p>
        {listo.voucher && <p className="text-xs text-muted">También te enviamos la ficha por correo.</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <Script src="https://cdn.conekta.io/js/latest/conekta.js" strategy="afterInteractive" />

      {/* El par que apartó, con la puerta para arrepentirse antes de pagar. */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        {elegido?.imagen && (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-elevated">
            <Image src={elegido.imagen} alt={elegido.nombre} fill sizes="64px" className="object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{elegido?.nombre ?? "Tu par del combo"}</p>
          {elegido && <p className="truncate text-xs capitalize text-muted">{elegido.label}</p>}
          <p className="nums mt-0.5 text-sm font-semibold text-accent">{mxn(totalCents)} <span className="text-xs font-normal text-muted">· pedido {childOrderNumber}</span></p>
        </div>
        {!fichaGenerada && (
          <button
            disabled={isPending}
            onClick={cambiar}
            className="shrink-0 text-xs text-muted underline-offset-2 transition-colors hover:text-accent hover:underline disabled:opacity-50"
          >
            Cambiar par
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metodos.map(({ id, label, hint }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setMetodo(id); setErr(null); }}
              aria-pressed={metodo === id}
              className={`relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${
                metodo === id ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-border hover:border-muted"
              }`}
            >
              <MethodMark id={id} />
              <span className="text-sm font-medium">{label}</span>
              <span className="text-[11px] leading-tight text-muted">{hint}</span>
            </button>
          ))}
        </div>

        {metodo === "card" && (
          <div className="mt-5 grid gap-5 md:grid-cols-[290px_1fr] md:items-center">
            <div className="mx-auto md:mx-0">
              <Cards number={card.number} name={card.name} expiry={card.expiry} cvc={card.cvc} focused={focus}
                placeholders={{ name: "TU NOMBRE" }} locale={{ valid: "válida hasta" }} />
            </div>
            <div className="space-y-3">
              <input value={card.number} onChange={(e) => setCardField("number", fmtNumber(e.target.value))}
                onFocus={() => setFocus("number")} onBlur={() => setFocus(undefined)}
                placeholder="Número de tarjeta" inputMode="numeric" autoComplete="cc-number" maxLength={19} required className={CI} />
              <input value={card.name} onChange={(e) => setCardField("name", e.target.value)}
                onFocus={() => setFocus("name")} onBlur={() => setFocus(undefined)}
                placeholder="Nombre en la tarjeta" autoComplete="cc-name" required className={CI} />
              <div className="grid grid-cols-2 gap-3">
                <input value={card.expiry} onChange={(e) => setCardField("expiry", fmtExpiry(e.target.value))}
                  onFocus={() => setFocus("expiry")} onBlur={() => setFocus(undefined)}
                  placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" maxLength={5} required className={CI} />
                <input value={card.cvc} onChange={(e) => setCardField("cvc", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onFocus={() => setFocus("cvc")} onBlur={() => setFocus(undefined)}
                  placeholder="CVC" inputMode="numeric" autoComplete="cc-csc" maxLength={4} required className={CI} />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <ShieldCheck size={14} weight="fill" className="text-accent" />
                Tus datos van directo a Conekta, nunca a nuestro servidor.
              </p>
            </div>
          </div>
        )}
        {metodo === "oxxo" && (
          <div className="mt-4 space-y-2.5 rounded-xl bg-accent-soft px-4 py-3">
            <p className="text-xs text-muted">Generamos un voucher con código de barras. Págalo en efectivo dentro de 3 días en:</p>
            <StoreLogos h={16} />
            <p className="text-[11px] text-muted">y +20,000 tiendas. <span className="font-medium text-text">No disponible en OXXO.</span> Detectamos tu pago automáticamente.</p>
          </div>
        )}
        {metodo === "aplazo" && (
          <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-xs text-muted">Te llevamos a Aplazo para aprobar; al volver, tu par queda confirmado.</p>
        )}
        {metodo === "mercadopago" && (
          <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-xs text-muted">Te llevamos a Mercado Pago — tarjeta o saldo, en una sola exhibición. Al volver, tu par queda confirmado.</p>
        )}

        {err && <p role="alert" className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{err}</p>}
        <button
          disabled={isPending}
          onClick={pagar}
          className="mt-5 w-full rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-contrast transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Procesando…" : `Pagar ${mxn(totalCents)}`}
        </button>
      </div>
    </div>
  );
}
