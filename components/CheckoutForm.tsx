"use client";

import Script from "next/script";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Cards, { type Focused } from "react-credit-cards-2";
import "react-credit-cards-2/dist/es/styles-compiled.css";
import { CheckCircle, Lock, Money, ShieldCheck, Truck, Tag } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { VisaMark, MastercardMark, AmexMark } from "@/components/PaymentBrands";
import { checkout, previewDiscount, type CheckoutResult, type CheckoutInput } from "@/app/checkout/actions";
import type { CartLine } from "@/app/cart/actions";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import { trackMeta } from "@/components/MetaPixel";
import { metaContentId } from "@/lib/meta-content";

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

// contact + shipping fields we persist on-device for the next purchase (no card, no fiscal)
const SAVE_KEY = "blade_checkout";
const SAVE_FIELDS = ["name", "email", "phone", "line1", "neighborhood", "city", "region", "postal"] as const;

const METHODS: { id: Method; label: string; hint: string }[] = [
  { id: "card", label: "Tarjeta", hint: "Crédito o débito" },
  { id: "oxxo", label: "Efectivo", hint: "+20,000 tiendas" },
  { id: "spei", label: "SPEI", hint: "Transferencia" },
  { id: "aplazo", label: "Aplazo", hint: "Págalo en quincenas" },
];

// Real brand logo on a white chip (keeps colour brands legible in both themes).
function LogoChip({ src, alt, h = 18 }: { src: string; alt: string; h?: number }) {
  return (
    <span className="inline-flex items-center rounded-md bg-white px-1.5 py-1 ring-1 ring-black/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ height: h }} className="w-auto" />
    </span>
  );
}

function MethodMark({ id }: { id: Method }) {
  if (id === "oxxo") return <Money size={20} weight="fill" className="text-accent" />;
  if (id === "spei") return <LogoChip src="/pay/spei.svg" alt="SPEI" h={14} />;
  if (id === "aplazo") return <LogoChip src="/pay/aplazo.png" alt="Aplazo" h={16} />;
  return (
    <span className="flex gap-1">
      <VisaMark />
      <MastercardMark />
    </span>
  );
}

// floating-label field — label rides up on focus/fill; no separate label clutter
function Field({
  name, label, type = "text", required = true, autoComplete, inputMode, maxLength, className = "", onInput, defaultValue,
}: {
  name: string; label: string; type?: string; required?: boolean; autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; maxLength?: number; className?: string;
  onInput?: React.FormEventHandler<HTMLInputElement>; defaultValue?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        id={name} name={name} type={type} required={required} placeholder=" " defaultValue={defaultValue}
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

export type CheckoutDefaults = Partial<
  Record<"name" | "email" | "phone" | "line1" | "neighborhood" | "city" | "region" | "postal", string>
>;

export function CheckoutForm({
  cartId, lines, subtotalCents, comboDiscountCents, totalCents, conektaPublicKey, defaults = {}, googleAuth = false,
}: {
  cartId: string; lines: CartLine[]; subtotalCents: number;
  comboDiscountCents: number; totalCents: number; conektaPublicKey: string;
  defaults?: CheckoutDefaults; googleAuth?: boolean;
}) {
  const [method, setMethod] = useState<Method>("card");
  const [needsInvoice, setNeedsInvoice] = useState(false);
  const [save, setSave] = useState(true);
  const [showCode, setShowCode] = useState(false);

  // Prefill contact/shipping from the last "saved" checkout on this device, but
  // only for fields the server didn't already fill (logged-in defaults win).
  useEffect(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    let saved: Record<string, string>;
    try { saved = JSON.parse(raw); } catch { return; }
    for (const f of SAVE_FIELDS) {
      const el = document.getElementById(f) as HTMLInputElement | null;
      if (el && !el.value && saved[f]) el.value = saved[f];
    }
    revalidate(); // prefilled values may already satisfy the form
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  // controlled card state drives the react-credit-cards-2 live preview
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" });
  const [focus, setFocus] = useState<Focused | undefined>(undefined);

  // Keep the pay button disabled until every required field is filled. The
  // contact/shipping inputs are uncontrolled, so lean on native validity
  // instead of mirroring them all into state.
  const formRef = useRef<HTMLFormElement>(null);
  const [formValid, setFormValid] = useState(false);
  const revalidate = () => setFormValid(!!formRef.current?.checkValidity());
  // fields appear/disappear with the payment method and the invoice toggle
  useEffect(revalidate, [method, needsInvoice, showCode, card]);

  // Meta: the buyer reached checkout with a real cart
  useEffect(() => {
    trackMeta("InitiateCheckout", {
      value: totalCents / 100,
      currency: "MXN",
      num_items: lines.reduce((n, l) => n + l.quantity, 0),
      content_ids: lines.map((l) => metaContentId(l.slug, l.color)),
    });
  }, []);

  // Discount code preview. create_order recomputes it at order time; this only
  // shows the buyer the real total before they commit.
  const [codeDiscount, setCodeDiscount] = useState(0);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  async function applyCode() {
    const code = (formRef.current?.elements.namedItem("discount") as HTMLInputElement)?.value ?? "";
    setCheckingCode(true);
    setCodeMsg(null);
    setError(null); // a previous attempt's failure isn't about this code
    try {
      const r = await previewDiscount(code, subtotalCents);
      if (r.ok) {
        setCodeDiscount(r.discountCents);
        setCodeMsg(`Código aplicado: −${mxn(r.discountCents)}`);
      } else {
        setCodeDiscount(0);
        setCodeMsg(r.error);
      }
    } finally {
      setCheckingCode(false);
    }
  }

  // combo discount is already baked into totalCents by the cart
  const effectiveTotal = Math.max(0, totalCents - codeDiscount);

  // Validate locally first: Conekta answers an opaque 422 for any malformed
  // field, so catch the fixable cases and say which one is wrong.
  function cardError(): string | null {
    const number = card.number.replace(/\s/g, "");
    const [mm, yy] = card.expiry.split("/");
    if (!/^\d{13,19}$/.test(number)) return "Revisa el número de tarjeta.";
    if (!card.name.trim()) return "Escribe el nombre como aparece en la tarjeta.";
    if (!mm || !yy || !/^\d{2}$/.test(mm) || Number(mm) < 1 || Number(mm) > 12 || !/^\d{2,4}$/.test(yy))
      return "Revisa la fecha de expiración (MM/AA).";
    if (!/^\d{3,4}$/.test(card.cvc)) return "Revisa el CVC.";
    return null;
  }

  function tokenizeCard(): Promise<string> {
    return new Promise((resolve, reject) => {
      const bad = cardError();
      if (bad) return reject(new Error(bad));
      if (!window.Conekta) return reject(new Error("Conekta.js no cargó"));
      window.Conekta.setPublicKey(conektaPublicKey);
      const [mm, yy] = card.expiry.split("/");
      window.Conekta.Token.create(
        {
          card: {
            number: card.number.replace(/\s/g, ""),
            name: card.name,
            exp_month: mm ?? "",
            exp_year: yy ? (yy.length === 2 ? `20${yy}` : yy) : "",
            cvc: card.cvc,
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

    // remember (or forget) the contact/shipping data for next time
    if (save) localStorage.setItem(SAVE_KEY, JSON.stringify(Object.fromEntries(SAVE_FIELDS.map((f) => [f, g(f)]))));
    else localStorage.removeItem(SAVE_KEY);

    try {
      let cardTokenId: string | undefined;
      if (method === "card") cardTokenId = await tokenizeCard();

      const input: CheckoutInput = {
        cartId,
        method,
        email: g("email"),
        customerName: g("name"),
        phone: g("phone"),
        shippingAddress: {
          name: g("name"), phone: g("phone"),
          line1: g("line1"), neighborhood: g("neighborhood"),
          city: g("city"), region: g("region"), postal: g("postal"), country: "MX",
        },
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
      if ("error" in res) {
        setError(res.error);
        return;
      }
      // Meta: only a card that cleared right now is a real purchase. Cash, SPEI
      // and Aplazo confirm later — the Conversions API reports those from the
      // webhook, sharing this eventID so Meta never double-counts.
      if (res.card?.paid) {
        trackMeta(
          "Purchase",
          {
            value: res.totalCents / 100,
            currency: "MXN",
            content_type: "product",
            content_ids: lines.map((l) => metaContentId(l.slug, l.color)),
          },
          res.orderNumber,
        );
      }
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

  const fmtNumber = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const fmtExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };
  const setCardField = (k: "number" | "name" | "expiry" | "cvc", v: string) => setCard((c) => ({ ...c, [k]: v }));

  const CI = "h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/10";

  const cta = method === "card" ? `Pagar ${mxn(effectiveTotal)}` : "Confirmar pedido";

  return (
    <>
      <Script src="https://cdn.conekta.io/js/latest/conekta.js" strategy="afterInteractive" />

      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Finalizar compra</h1>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Lock size={14} weight="fill" /> Pago cifrado
        </span>
      </div>

      <form ref={formRef} onSubmit={onSubmit} onInput={revalidate} onChange={revalidate} className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* 1 — contact + shipping */}
          <section className={CARD}>
            <StepHeader n={1} title="Contacto y envío" />
            {googleAuth && (
              <div className="mb-4">
                <GoogleSignInButton next="/checkout" label="Autocompletar con Google" />
                <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                  <span className="h-px flex-1 bg-border" /> o captura tus datos <span className="h-px flex-1 bg-border" />
                </div>
              </div>
            )}
            <PlacesAutocomplete />
            <div className="space-y-3">
              <Field name="name" label="Nombre completo" autoComplete="name" defaultValue={defaults.name} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="email" label="Correo electrónico" type="email" autoComplete="email" inputMode="email" defaultValue={defaults.email} />
                <Field name="phone" label="Teléfono" type="tel" autoComplete="tel" inputMode="tel" defaultValue={defaults.phone} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="line1" label="Calle y número" autoComplete="address-line1" defaultValue={defaults.line1} />
                <Field name="neighborhood" label="Colonia" autoComplete="address-line2" defaultValue={defaults.neighborhood} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field name="city" label="Ciudad / Municipio" autoComplete="address-level2" className="sm:col-span-1" defaultValue={defaults.city} />
                <Field name="region" label="Estado" autoComplete="address-level1" defaultValue={defaults.region} />
                <Field name="postal" label="C.P." autoComplete="postal-code" inputMode="numeric" maxLength={5} defaultValue={defaults.postal} />
              </div>
              <p className="flex items-center gap-1.5 pt-0.5 text-xs text-muted">
                <Truck size={14} /> Envío gratis a todo México en 4–7 días hábiles.
              </p>
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={save}
                  onChange={(e) => setSave(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Guardar mis datos para la próxima compra
              </label>
            </div>
          </section>

          {/* 2 — payment method */}
          <section className={CARD}>
            <StepHeader n={2} title="Pago" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map(({ id, label, hint }) => (
                <button
                  type="button" key={id} onClick={() => setMethod(id)}
                  aria-pressed={method === id}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${
                    method === id
                      ? "border-accent bg-accent-soft ring-1 ring-accent"
                      : "border-border hover:border-muted"
                  }`}
                >
                  <MethodMark id={id} />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-[11px] leading-tight text-muted">{hint}</span>
                </button>
              ))}
            </div>

            {method === "card" && (
              <div className="mt-5 grid gap-5 md:grid-cols-[290px_1fr] md:items-center">
                <div className="mx-auto md:mx-0">
                  <Cards
                    number={card.number}
                    name={card.name}
                    expiry={card.expiry}
                    cvc={card.cvc}
                    focused={focus}
                    placeholders={{ name: "TU NOMBRE" }}
                    locale={{ valid: "válida hasta" }}
                  />
                </div>
                <div className="space-y-3">
                  <input
                    value={card.number} onChange={(e) => setCardField("number", fmtNumber(e.target.value))}
                    onFocus={() => setFocus("number")} onBlur={() => setFocus(undefined)}
                    placeholder="Número de tarjeta" inputMode="numeric" autoComplete="cc-number" maxLength={19} required className={CI}
                  />
                  <input
                    value={card.name} onChange={(e) => setCardField("name", e.target.value)}
                    onFocus={() => setFocus("name")} onBlur={() => setFocus(undefined)}
                    placeholder="Nombre en la tarjeta" autoComplete="cc-name" required className={CI}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={card.expiry} onChange={(e) => setCardField("expiry", fmtExpiry(e.target.value))}
                      onFocus={() => setFocus("expiry")} onBlur={() => setFocus(undefined)}
                      placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" maxLength={5} required className={CI}
                    />
                    <input
                      value={card.cvc} onChange={(e) => setCardField("cvc", e.target.value.replace(/\D/g, "").slice(0, 4))}
                      onFocus={() => setFocus("cvc")} onBlur={() => setFocus(undefined)}
                      placeholder="CVC" inputMode="numeric" autoComplete="cc-csc" maxLength={4} required className={CI}
                    />
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <ShieldCheck size={14} weight="fill" className="text-accent" />
                    Tus datos van directo a Conekta, nunca a nuestro servidor.
                  </p>
                </div>
              </div>
            )}
            {method === "oxxo" && (
              <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-xs text-muted">
                Generamos un voucher con código de barras. Págalo en efectivo dentro de 3 días en 7-Eleven, Walmart, Bodega Aurrerá, Circle K, Sam's Club, Farmacias del Ahorro, Soriana y más.
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
              <>
                <div className="flex items-end gap-2">
                  <Field name="discount" label="Código de descuento" required={false} className="flex-1" />
                  <button
                    type="button"
                    disabled={checkingCode}
                    onClick={applyCode}
                    className="h-14 shrink-0 rounded-xl border border-accent px-4 text-sm font-medium text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
                  >
                    {checkingCode ? "…" : "Aplicar"}
                  </button>
                </div>
                {codeMsg && (
                  <p className={`mt-2 text-xs ${codeDiscount > 0 ? "text-accent" : "text-muted"}`}>{codeMsg}</p>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal (IVA incl.)</span>
              <span className="nums">{mxn(subtotalCents)}</span>
            </div>
            {comboDiscountCents > 0 && (
              <div className="flex justify-between">
                <span className="text-accent">Descuento combo</span>
                <span className="nums font-medium text-accent">−{mxn(comboDiscountCents)}</span>
              </div>
            )}
            {codeDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-accent">Código de descuento</span>
                <span className="nums font-medium text-accent">−{mxn(codeDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted">Envío</span>
              <span className="font-medium text-accent">Gratis</span>
            </div>
            <div className="flex items-baseline justify-between pt-1.5">
              <span className="font-semibold">Total</span>
              <span className="nums text-xl font-semibold">{mxn(effectiveTotal)}</span>
            </div>
          </div>

          {error && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p>}

          <button
            disabled={loading || !formValid || (method === "card" && cardError() !== null)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Procesando…" : <><Lock size={15} weight="fill" /> {cta}</>}
          </button>
          {!loading && !formValid && (
            <p className="mt-2 text-center text-xs text-muted">Completa tus datos para continuar.</p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <VisaMark />
            <MastercardMark />
            <AmexMark />
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-1 text-[11px] font-semibold text-zinc-900 ring-1 ring-black/5">
              <Money size={13} weight="fill" /> Efectivo
            </span>
            <LogoChip src="/pay/spei.svg" alt="SPEI" h={12} />
            <LogoChip src="/pay/aplazo.png" alt="Aplazo" h={14} />
          </div>
          <p className="text-center text-[11px] leading-relaxed text-muted">
            Efectivo en 7-Eleven, Walmart, Bodega Aurrerá, Circle K, Sam&apos;s Club, Farmacias del Ahorro,
            Soriana y +20,000 tiendas. <span className="font-medium">No disponible en OXXO.</span>
          </p>
          <p className="flex items-center justify-center gap-1 text-[11px] text-muted">
            <ShieldCheck size={13} weight="fill" /> Compra protegida · procesado por Conekta
          </p>
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
          <p className="text-sm text-muted">Muestra este código en la caja de 7-Eleven, Walmart, Bodega Aurrerá, Circle K, Sam's Club, Farmacias del Ahorro, Soriana y más:</p>
          <div className="rounded-xl bg-white p-4 text-center">
            {result.oxxo.voucherUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.oxxo.voucherUrl} alt="Código de barras para pago en efectivo" className="mx-auto max-h-44 w-auto" />
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
