"use client";

import Script from "next/script";
import Image from "next/image";
import { useState } from "react";
import {
  CreditCard, Storefront, Bank, Coins, CheckCircle, Lock, ShieldCheck, Truck, Tag, CaretDown,
} from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { checkout, type CheckoutResult, type CheckoutInput } from "@/app/checkout/actions";
import type { CartLine } from "@/app/cart/actions";

type Method = "card" | "oxxo" | "spei" | "aplazo";

declare global {
  interface Window {
    Conekta?: {
      setPublicKey: (k: string) => void;
      Token: {
        create: (
          params: { card: { number: string; name: string; exp_year: string; exp_month: string; cvc: string } },
          success: (res: { id: string }) => void,
          error: (err: { message_to_purchaser?: string; message?: string }) => void,
        ) => void;
      };
    };
  }
}

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

const METHODS: { id: Method; label: string; icon: typeof CreditCard; hint: string }[] = [
  { id: "card", label: "Tarjeta", icon: CreditCard, hint: "Crédito o débito" },
  { id: "oxxo", label: "OXXO", icon: Storefront, hint: "Paga en efectivo" },
  { id: "spei", label: "SPEI", icon: Bank, hint: "Transferencia" },
  { id: "aplazo", label: "Aplazo", icon: Coins, hint: "Págalo en quincenas" },
];

// floating-label field — label rides up on focus/fill; no separate label clutter
function Field({
  name, label, type = "text", required = true, autoComplete, inputMode, maxLength, className = "", onInput,
}: {
  name: string; label: string; type?: string; required?: boolean; autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; maxLength?: number; className?: string;
  onInput?: React.FormEventHandler<HTMLInputElement>;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        id={name} name={name} type={type} required={required} placeholder=" "
        autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} onInput={onInput}
        className="peer h-14 w-full rounded-xl border border-border bg-surface px-3.5 pt-5 pb-1.5 text-sm text-text outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/10"
      />
      <label
        htmlFor={name}
        className="pointer-events-none absolute left-3.5 top-2 text-xs text-muted transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-accent"
      >
        {label}
      </label>
    </div>
  );
}

function StepHeader({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-contrast">{n}</span>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

const CARD = "rounded-2xl border border-border bg-surface p-5 sm:p-6";

export function CheckoutForm({
  cartId, lines, subtotalCents, conektaPublicKey,
}: {
  cartId: string; lines: CartLine[]; subtotalCents: number; conektaPublicKey: string;
}) {
  const [method, setMethod] = useState<Method>("card");
  const [needsInvoice, setNeedsInvoice] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  function tokenizeCard(form: HTMLFormElement): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!window.Conekta) return reject(new Error("Conekta.js no cargó"));
      window.Conekta.setPublicKey(conektaPublicKey);
      const f = (n: string) => (form.elements.namedItem(n) as HTMLInputElement)?.value ?? "";
      window.Conekta.Token.create(
        {
          card: {
            number: f("card_number").replace(/\s/g, ""),
            name: f("card_name"),
            exp_year: f("card_exp_year"),
            exp_month: f("card_exp_month"),
            cvc: f("card_cvc"),
          },
        },
        (res) => resolve(res.id),
        (err) => reject(new Error(err.message_to_purchaser ?? err.message ?? "error de tarjeta")),
      );
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = e.currentTarget;
    const g = (n: string) => (form.elements.namedItem(n) as HTMLInputElement)?.value ?? "";

    try {
      let cardTokenId: string | undefined;
      if (method === "card") cardTokenId = await tokenizeCard(form);

      const input: CheckoutInput = {
        cartId,
        method,
        email: g("email"),
        customerName: g("name"),
        phone: g("phone"),
        shippingAddress: { line1: g("line1"), city: g("city"), region: g("region"), postal: g("postal"), country: "MX" },
        discountCode: g("discount") || undefined,
        cardTokenId,
        fiscal: needsInvoice
          ? {
              rfc: g("rfc"), fiscal_name: g("fiscal_name"), fiscal_regime: g("fiscal_regime"),
              cfdi_use: g("cfdi_use"), postal_code: g("fiscal_postal"), email: g("email"),
            }
          : undefined,
      };

      const res = await checkout(input);
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "el pago falló");
    } finally {
      setLoading(false);
    }
  }

  if (result) return <Confirmation result={result} />;

  // auto-space card number as the user types: 1234 5678 9012 3456
  const spaceCard: React.FormEventHandler<HTMLInputElement> = (e) => {
    const el = e.currentTarget;
    el.value = el.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  };

  const cta = method === "card" ? `Pagar ${mxn(subtotalCents)}` : "Confirmar pedido";

  return (
    <>
      <Script src="https://cdn.conekta.io/js/latest/conekta.js" strategy="afterInteractive" />

      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Finalizar compra</h1>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Lock size={14} weight="fill" /> Pago cifrado
        </span>
      </div>

      <form onSubmit={onSubmit} className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* 1 — contact + shipping */}
          <section className={CARD}>
            <StepHeader n={1} title="Contacto y envío" />
            <div className="space-y-3">
              <Field name="name" label="Nombre completo" autoComplete="name" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="email" label="Correo electrónico" type="email" autoComplete="email" inputMode="email" />
                <Field name="phone" label="Teléfono" type="tel" autoComplete="tel" inputMode="tel" />
              </div>
              <Field name="line1" label="Calle y número" autoComplete="address-line1" />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field name="city" label="Ciudad" autoComplete="address-level2" className="sm:col-span-1" />
                <Field name="region" label="Estado" autoComplete="address-level1" />
                <Field name="postal" label="C.P." autoComplete="postal-code" inputMode="numeric" maxLength={5} />
              </div>
              <p className="flex items-center gap-1.5 pt-0.5 text-xs text-muted">
                <Truck size={14} /> Envío a todo México. Lo calculamos sin costo en este demo.
              </p>
            </div>
          </section>

          {/* 2 — payment method */}
          <section className={CARD}>
            <StepHeader n={2} title="Pago" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map(({ id, label, icon: Icon, hint }) => (
                <button
                  type="button" key={id} onClick={() => setMethod(id)}
                  aria-pressed={method === id}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                    method === id
                      ? "border-accent bg-accent-soft ring-1 ring-accent"
                      : "border-border hover:border-muted"
                  }`}
                >
                  <Icon size={20} weight={method === id ? "fill" : "regular"} className={method === id ? "text-accent" : "text-muted"} />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-[11px] leading-tight text-muted">{hint}</span>
                </button>
              ))}
            </div>

            {method === "card" && (
              <div className="mt-4 space-y-3">
                <Field name="card_name" label="Nombre en la tarjeta" autoComplete="cc-name" />
                <div className="relative">
                  <Field name="card_number" label="Número de tarjeta" autoComplete="cc-number" inputMode="numeric" maxLength={19} onInput={spaceCard} />
                  <CreditCard size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field name="card_exp_month" label="Mes (MM)" autoComplete="cc-exp-month" inputMode="numeric" maxLength={2} />
                  <Field name="card_exp_year" label="Año (AAAA)" autoComplete="cc-exp-year" inputMode="numeric" maxLength={4} />
                  <Field name="card_cvc" label="CVC" autoComplete="cc-csc" inputMode="numeric" maxLength={4} />
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <ShieldCheck size={14} weight="fill" className="text-accent" />
                  Tus datos van directo a Conekta, nunca a nuestro servidor.
                </p>
              </div>
            )}
            {method === "oxxo" && (
              <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-xs text-muted">
                Generamos un voucher con código de barras. Págalo en cualquier OXXO dentro de 3 días.
              </p>
            )}
            {method === "spei" && (
              <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-xs text-muted">
                Generamos una CLABE para transferencia. El pedido se confirma al recibir el pago.
              </p>
            )}
            {method === "aplazo" && (
              <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-xs text-muted">
                Paga en quincenas sin tarjeta. Te llevamos a Aplazo para aprobar; al volver, tu pedido queda confirmado.
              </p>
            )}
          </section>

          {/* 3 — invoice (optional) */}
          <section className={CARD}>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox" checked={needsInvoice}
                onChange={(e) => setNeedsInvoice(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="font-medium">Necesito factura (CFDI)</span>
              <span className="text-xs text-muted">Opcional</span>
            </label>
            {needsInvoice && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field name="rfc" label="RFC" />
                <Field name="fiscal_name" label="Razón social / nombre" />
                <Field name="fiscal_regime" label="Régimen fiscal (clave SAT)" />
                <Field name="cfdi_use" label="Uso CFDI (ej. G03)" />
                <Field name="fiscal_postal" label="C.P. fiscal" inputMode="numeric" maxLength={5} />
              </div>
            )}
          </section>
        </div>

        {/* summary */}
        <aside className="space-y-4 rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold">Tu pedido <span className="text-muted">· {lines.length} {lines.length === 1 ? "artículo" : "artículos"}</span></h2>

          <ul className="space-y-3">
            {lines.map((l) => (
              <li key={l.variantId} className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-elevated">
                  {l.image && <Image src={l.image} alt={l.productName} fill sizes="56px" className="object-cover" />}
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-text px-1 text-[11px] font-medium text-bg">{l.quantity}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.productName}</p>
                  <p className="truncate text-xs text-muted">{l.label}</p>
                </div>
                <p className="nums shrink-0 text-sm font-medium">{mxn(l.unitPriceCents * l.quantity)}</p>
              </li>
            ))}
          </ul>

          {/* discount — tucked away so it doesn't clutter */}
          <div className="border-t border-border pt-3">
            {!showCode ? (
              <button type="button" onClick={() => setShowCode(true)} className="flex items-center gap-1.5 text-xs font-medium text-accent">
                <Tag size={14} /> ¿Tienes un código de descuento?
              </button>
            ) : (
              <Field name="discount" label="Código de descuento" required={false} />
            )}
          </div>

          <div className="space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal (IVA incl.)</span>
              <span className="nums">{mxn(subtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Envío</span>
              <span className="font-medium text-accent">Gratis</span>
            </div>
            <div className="flex items-baseline justify-between pt-1.5">
              <span className="font-semibold">Total</span>
              <span className="nums text-xl font-semibold">{mxn(subtotalCents)}</span>
            </div>
          </div>

          {error && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p>}

          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "Procesando…" : <><Lock size={15} weight="fill" /> {cta}</>}
          </button>

          <div className="flex items-center justify-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1"><ShieldCheck size={13} weight="fill" /> Compra protegida</span>
            <span className="flex items-center gap-1"><CreditCard size={13} /> Conekta</span>
          </div>
        </aside>
      </form>
    </>
  );
}

function Confirmation({ result }: { result: CheckoutResult }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2 text-accent">
        <CheckCircle size={24} weight="fill" />
        <h2 className="text-lg font-semibold text-text">Pedido {result.orderNumber}</h2>
      </div>
      <p className="nums text-sm">Total: {mxn(result.totalCents)}</p>

      {result.method === "card" && (
        <p className="text-sm text-muted">
          {result.card?.paid ? "Pago confirmado. ¡Gracias!" : "Pago en proceso, recibirás un correo en breve."}
        </p>
      )}

      {result.method === "oxxo" && result.oxxo && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Muestra este código en la caja de cualquier OXXO:</p>
          <div className="rounded-xl bg-white p-4 text-center">
            {result.oxxo.voucherUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.oxxo.voucherUrl} alt="Código de barras OXXO Pay" className="mx-auto max-h-44 w-auto" />
            )}
            <p className="mt-2 font-mono text-sm tracking-wider text-zinc-900">{result.oxxo.reference}</p>
          </div>
          <p className="nums text-sm">Monto a pagar: <span className="font-medium">{mxn(result.totalCents)}</span></p>
          {result.expiresAt && (
            <p className="text-xs text-muted">Vence {new Date(result.expiresAt).toLocaleString("es-MX")}</p>
          )}
          {result.oxxo.voucherUrl && (
            <a href={result.oxxo.voucherUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-accent underline">
              Abrir comprobante para imprimir
            </a>
          )}
        </div>
      )}

      {result.method === "spei" && result.spei && (
        <div className="space-y-2">
          <p className="text-sm text-muted">Transfiere el total a esta CLABE{result.spei.bank ? ` (${result.spei.bank})` : ""}:</p>
          <p className="nums rounded-lg bg-elevated p-3 text-lg">{result.spei.clabe}</p>
          {result.expiresAt && (
            <p className="text-xs text-muted">Vence {new Date(result.expiresAt).toLocaleString("es-MX")}</p>
          )}
        </div>
      )}

      <p className="text-xs text-muted">Te confirmaremos por correo cuando se reciba el pago.</p>
    </div>
  );
}
