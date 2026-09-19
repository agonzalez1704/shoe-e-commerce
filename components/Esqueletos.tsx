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

// Admin: el layout (sidebar) queda montado; estos llenan solo la columna de
// contenido con la forma de cada tipo de pantalla.
function EncabezadoAdmin() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className={`${PULSO} h-7 w-40 rounded-lg`} />
      <div className={`${PULSO} h-9 w-56 rounded-full`} />
    </div>
  );
}

// Listas: pedidos, productos, inventario, descuentos, promociones, combos...
export function EsqueletoAdminLista({ filas = 8 }: { filas?: number }) {
  return (
    <div className="space-y-5">
      <EncabezadoAdmin />
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className={`${PULSO} h-4 w-24 rounded-md`} />
            <div className={`${PULSO} h-4 flex-1 rounded-md`} />
            <div className={`${PULSO} h-4 w-16 rounded-md`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Detalle: pedido, editar producto.
export function EsqueletoAdminDetalle() {
  return (
    <div className="space-y-6">
      <div className={`${PULSO} h-4 w-20 rounded-md`} />
      <div className={`${PULSO} h-8 w-48 rounded-lg`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`${PULSO} h-96 lg:col-span-2`} />
        <div className={`${PULSO} h-64`} />
      </div>
    </div>
  );
}

// Tableros: metricas, dashboards.
export function EsqueletoAdminTablero() {
  return (
    <div className="space-y-8">
      <EncabezadoAdmin />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${PULSO} h-24`} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${PULSO} h-72`} />
        <div className={`${PULSO} h-72`} />
      </div>
    </div>
  );
}
