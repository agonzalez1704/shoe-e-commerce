"use client";

import Script from "next/script";
import { useState } from "react";
import { CreditCard, Storefront, Bank, Coins, CheckCircle } from "@phosphor-icons/react";
import { formatCents } from "@/lib/money";
import { checkout, type CheckoutResult, type CheckoutInput } from "@/app/checkout/actions";

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
const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-muted/70 outline-none transition-colors focus:border-text";

const METHODS: { id: Method; label: string; icon: typeof CreditCard }[] = [
  { id: "card", label: "Tarjeta", icon: CreditCard },
  { id: "oxxo", label: "OXXO", icon: Storefront },
  { id: "spei", label: "SPEI", icon: Bank },
  { id: "aplazo", label: "Aplazo", icon: Coins },
];

export function CheckoutForm({
  cartId,
  subtotalCents,
  conektaPublicKey,
}: {
  cartId: string;
  subtotalCents: number;
  conektaPublicKey: string;
}) {
  const [method, setMethod] = useState<Method>("card");
  const [needsInvoice, setNeedsInvoice] = useState(false);
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
            number: f("card_number"),
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
      // redirect to provider — card 3DS challenge or Aplazo approval; webhook commits after
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

  return (
    <>
      <Script src="https://cdn.conekta.io/js/latest/conekta.js" strategy="afterInteractive" />
      <form onSubmit={onSubmit} className="grid gap-10 md:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Contacto y envío</h2>
            <input name="name" placeholder="Nombre completo" required className={INPUT} />
            <input name="email" type="email" placeholder="Correo electrónico" required className={INPUT} />
            <input name="phone" type="tel" placeholder="Teléfono (ej. +52 81 1234 5678)" required className={INPUT} />
            <input name="line1" placeholder="Calle y número" required className={INPUT} />
            <div className="grid grid-cols-2 gap-3">
              <input name="city" placeholder="Ciudad" required className={INPUT} />
              <input name="region" placeholder="Estado" required className={INPUT} />
            </div>
            <input name="postal" placeholder="Código postal" required className={INPUT} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Método de pago</h2>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setMethod(id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border py-4 text-sm font-medium transition-colors ${
                    method === id ? "border-accent text-accent" : "border-border text-muted hover:text-text"
                  }`}
                >
                  <Icon size={22} weight={method === id ? "fill" : "regular"} />
                  {label}
                </button>
              ))}
            </div>

            {method === "card" && (
              <div className="space-y-3 pt-1">
                <input name="card_name" placeholder="Nombre en la tarjeta" className={INPUT} />
                <input name="card_number" placeholder="Número de tarjeta" inputMode="numeric" className={INPUT} />
                <div className="grid grid-cols-3 gap-3">
                  <input name="card_exp_month" placeholder="MM" className={INPUT} />
                  <input name="card_exp_year" placeholder="AAAA" className={INPUT} />
                  <input name="card_cvc" placeholder="CVC" className={INPUT} />
                </div>
                <p className="text-xs text-muted">Los datos de tu tarjeta van directo a Conekta, nunca a nuestro servidor.</p>
              </div>
            )}
            {method === "oxxo" && (
              <p className="rounded-lg bg-accent-soft px-3 py-2.5 text-xs text-muted">
                Se generará un voucher con código de barras. Paga en cualquier OXXO dentro de 3 días.
              </p>
            )}
            {method === "spei" && (
              <p className="rounded-lg bg-accent-soft px-3 py-2.5 text-xs text-muted">
                Se generará una CLABE para transferencia. El pedido se confirma al recibir el pago.
              </p>
            )}
            {method === "aplazo" && (
              <p className="rounded-lg bg-accent-soft px-3 py-2.5 text-xs text-muted">
                Paga en quincenas sin tarjeta. Te llevaremos a Aplazo para aprobar tu compra; al volver, tu pedido queda confirmado.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={needsInvoice} onChange={(e) => setNeedsInvoice(e.target.checked)} className="accent-[var(--accent)]" />
              Necesito factura (CFDI)
            </label>
            {needsInvoice && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <input name="rfc" placeholder="RFC" className={INPUT} />
                <input name="fiscal_name" placeholder="Razón social / nombre" className={INPUT} />
                <input name="fiscal_regime" placeholder="Régimen fiscal (clave SAT)" className={INPUT} />
                <input name="cfdi_use" placeholder="Uso CFDI (ej. G03)" className={INPUT} />
                <input name="fiscal_postal" placeholder="Código postal fiscal" className={INPUT} />
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-3 rounded-2xl border border-border bg-surface p-5 md:sticky md:top-24">
          <h2 className="text-sm font-medium">Resumen</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Subtotal (IVA incl.)</span>
            <span className="nums font-medium">{mxn(subtotalCents)}</span>
          </div>
          <input name="discount" placeholder="Código de descuento" className={INPUT} />
          {error && <p className="text-sm text-accent">{error}</p>}
          <button
            disabled={loading}
            className="w-full rounded-full bg-accent px-6 py-3.5 text-sm font-medium text-accent-contrast transition-transform active:scale-[0.99] disabled:bg-border disabled:text-muted"
          >
            {loading ? "Procesando…" : "Realizar pedido"}
          </button>
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
          {/* white card so the barcode scans regardless of theme */}
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
