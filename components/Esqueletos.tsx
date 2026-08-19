// Esqueletos de carga por ruta (loading.tsx). Imitan las dimensiones del layout
// real —la reja usa las mismas columnas y proporciones que ProductGrid— para
// que el reemplazo no brinque nada (CLS). Sin loading.tsx la navegación se
// queda congelada en la página anterior hasta que el servidor responde.
const PULSO = "animate-pulse rounded-2xl bg-elevated";

export function EsqueletoReja({ cards = 12 }: { cards?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3.5 gap-y-8 sm:gap-x-5 sm:gap-y-10 md:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <li key={i}>
          <div className={`${PULSO} aspect-square`} />
          <div className="mt-3.5 space-y-2">
            <div className={`${PULSO} h-4 w-2/3 rounded-md`} />
            <div className={`${PULSO} h-3 w-1/3 rounded-md`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EsqueletoEncabezado() {
  return (
    <div className="mb-6 space-y-2">
      <div className={`${PULSO} h-8 w-48 rounded-lg`} />
      <div className={`${PULSO} h-4 w-72 rounded-md`} />
    </div>
  );
}

export function EsqueletoPdp() {
  return (
    <div className="grid gap-8 py-8 md:grid-cols-2">
      <div className={`${PULSO} aspect-square`} />
      <div className="space-y-4">
        <div className={`${PULSO} h-4 w-24 rounded-md`} />
        <div className={`${PULSO} h-10 w-3/4 rounded-lg`} />
        <div className={`${PULSO} h-8 w-32 rounded-lg`} />
        <div className="flex flex-wrap gap-1.5 pt-2">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className={`${PULSO} h-8 w-11 rounded-md`} />
          ))}
        </div>
        <div className={`${PULSO} h-12 w-full rounded-full`} />
      </div>
    </div>
  );
}
