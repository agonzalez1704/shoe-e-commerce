import Link from "next/link";
import { Gift } from "@phosphor-icons/react/dist/ssr";
import { CopiarCodigo } from "@/components/CopiarCodigo";
import { formatCents } from "@/lib/money";

// Crédito para la siguiente compra (docs/CREDITO-BLADE.md). Mismo lenguaje que
// los cupones de Mi cuenta (borde punteado en acento) para que se lea como
// "esto es tuyo", no como publicidad.
export function CreditoGanado({ code, montoCents, venceIso }: { code: string; montoCents: number; venceIso: string }) {
  const monto = formatCents(montoCents, "MXN", "es-MX").replace(/\.00$/, "");
  const vence = new Date(venceIso).toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" });
  return (
    <section className="mb-8 rounded-2xl border-[1.5px] border-dashed border-accent/40 bg-accent-soft/40 p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast">
          <Gift size={22} weight="fill" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-accent">Ganaste crédito</p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">
            <span className="nums">{monto}</span> para tu próximo par
          </h2>
          <p className="mt-1 text-sm text-muted">
            Se suma al combo de 2 pares y a las promociones. Vence el <strong className="text-text">{vence}</strong>.
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-4 py-2.5">
        <span className="nums truncate font-semibold tracking-[0.12em]">{code}</span>
        <CopiarCodigo code={code} />
      </div>
      <p className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <span>Un solo uso. ¿No lo vas a usar? Regálaselo a alguien.</span>
        <Link href={`/products?credito=${encodeURIComponent(code)}`} className="text-sm font-medium text-accent">
          Usarlo ahora →
        </Link>
      </p>
    </section>
  );
}
