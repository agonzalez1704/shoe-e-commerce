import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { listBestSellers, listFeatured } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductGrid";
import { NombreModelo } from "@/components/NombreModelo";

// Lo que se ve cuando algo no existe: un modelo archivado (Manhattan) o una
// direccion rota. En vez de un "error" sin salida, lo que mas se vende y dos
// caminos para seguir comprando. Next marca la respuesta como noindex solo.
export async function NoEncontrado({ modelo = false }: { modelo?: boolean }) {
  const vendidos = await listBestSellers(6);
  const sugeridos = vendidos.length ? vendidos : await listFeatured(6);
  const hayCombo = sugeridos.some((p) => p.comboMinQty != null);

  return (
    <div className="py-10 sm:py-16">
      <section className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {modelo ? "Modelo no disponible" : "Página no encontrada"}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
          {modelo ? <NombreModelo /> : "Esta página ya no está aquí"}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
          {modelo
            ? "Lo retiramos del catálogo, pero estos pares hechos a mano en León están listos para ti."
            : "Puede que el enlace esté incompleto o que lo hayamos movido. Mientras, esto es lo que más se está llevando la gente."}
        </p>
        <div className="mt-7 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          {hayCombo && (
            <Link
              href="/combo"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-[15px] font-semibold text-accent-contrast transition-transform active:scale-[0.98]"
            >
              Arma tu combo
              <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          <Link
            href="/products"
            className={`inline-flex h-12 items-center justify-center rounded-full px-7 text-[15px] font-semibold transition-colors ${
              hayCombo ? "border border-border hover:border-text" : "bg-accent text-accent-contrast"
            }`}
          >
            Ver toda la tienda
          </Link>
        </div>
      </section>

      {sugeridos.length > 0 && (
        <section className="mt-14 border-t border-border pt-10 sm:mt-20">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {modelo ? "Te pueden gustar" : "Los más vendidos"}
              </h2>
              <p className="mt-1.5 text-sm text-muted">Envío gratis a todo México · se fabrican en 4 a 7 días.</p>
            </div>
            <Link href="/products" className="group hidden items-center gap-1.5 text-sm font-medium text-accent sm:inline-flex">
              Ver todo
              <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <ProductGrid products={sugeridos} />
        </section>
      )}
    </div>
  );
}
