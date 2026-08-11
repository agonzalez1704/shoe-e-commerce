import { activeBrand } from "@/lib/brand";

// Terms and the privacy notice name a real, legally responsible operator. On a
// fresh store that block is empty, and publishing the previous store's RFC would
// be worse than publishing nothing — so the page refuses to render the legal
// text and says what's missing instead.
export function legalConfigured(): boolean {
  const l = activeBrand.legal;
  return !!(l.operator && l.rfc && l.address);
}

// Shipping and returns are commercial promises, not legal identity: they need
// no RFC, but publishing another store's lead time and free-shipping pledge is
// the same failure. `pdp.shipping` is the signal that a brand has stated terms
// of its own.
export function shippingConfigured(): boolean {
  return !!activeBrand.pdp?.shipping?.length;
}

export function LegalPending({
  page,
  heading = "Falta configurar los datos fiscales de la tienda",
  body = "Esta página debe nombrar al operador legal (razón social, RFC y domicilio). Están vacíos en la configuración de la marca, así que no se publica un texto legal incompleto.",
  field = "legal",
}: {
  page: string;
  heading?: string;
  body?: string;
  field?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{page}</h1>
      <div className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft p-5 text-sm">
        <p className="font-medium text-accent">{heading}</p>
        <p className="mt-2 text-muted">{body}</p>
        <p className="mt-2 text-muted">
          Llena <span className="nums">{field}</span> en <span className="nums">lib/brand.ts</span> para la marca{" "}
          <span className="nums font-medium text-text">{activeBrand.key}</span>.
        </p>
      </div>
      {activeBrand.legal.supportEmail && (
        <p className="mt-6 text-sm text-muted">
          Mientras tanto, escríbenos a{" "}
          <a href={`mailto:${activeBrand.legal.supportEmail}`} className="text-accent underline">
            {activeBrand.legal.supportEmail}
          </a>
          .
        </p>
      )}
    </div>
  );
}
