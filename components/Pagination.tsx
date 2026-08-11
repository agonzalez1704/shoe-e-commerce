import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";

export const POR_PAGINA = 24; // divisible entre 2, 3 y 4: cuadra con la grid

// Enlaces reales, no un botón con JS: cada página tiene su URL, el buscador la
// puede rastrear, y funcionan el clic derecho y el botón de atrás del navegador.
export function Pagination({
  pagina,
  total,
  base,
  params,
}: {
  pagina: number;
  total: number;        // total de tarjetas, no de páginas
  base: string;         // "/categoria/scooters"
  params?: Record<string, string | undefined>; // filtros que hay que conservar
}) {
  const paginas = Math.ceil(total / POR_PAGINA);
  if (paginas <= 1) return null;

  // Se acota a los extremos: en la última página, un `siguiente` apuntando a
  // p+1 seguiría siendo un enlace rastreable a una cuadrícula vacía.
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) q.set(k, v);
    if (p > 1) q.set("p", String(p));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  // Ventana alrededor de la actual: con 13 páginas, trece números no ayudan a
  // nadie y en móvil no caben.
  const ventana = new Set<number>([1, paginas, pagina - 1, pagina, pagina + 1]);
  const numeros = [...ventana].filter((p) => p >= 1 && p <= paginas).sort((a, b) => a - b);

  return (
    <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-1">
      <Link
        href={href(Math.max(1, pagina - 1))}
        aria-label="Página anterior"
        aria-disabled={pagina === 1}
        className={`grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:text-text ${
          pagina === 1 ? "pointer-events-none opacity-30" : ""
        }`}
      >
        <CaretLeft size={16} weight="bold" />
      </Link>

      {numeros.map((p, i) => (
        <span key={p} className="flex items-center">
          {/* hueco cuando la ventana salta */}
          {i > 0 && p - numeros[i - 1] > 1 && <span className="px-1 text-sm text-muted">…</span>}
          <Link
            href={href(p)}
            aria-current={p === pagina ? "page" : undefined}
            className={`nums grid h-11 min-w-11 place-items-center rounded-full px-2 text-sm transition-colors ${
              p === pagina ? "bg-accent font-semibold text-accent-contrast" : "text-muted hover:text-text"
            }`}
          >
            {p}
          </Link>
        </span>
      ))}

      <Link
        href={href(Math.min(paginas, pagina + 1))}
        aria-label="Página siguiente"
        aria-disabled={pagina === paginas}
        className={`grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:text-text ${
          pagina === paginas ? "pointer-events-none opacity-30" : ""
        }`}
      >
        <CaretRight size={16} weight="bold" />
      </Link>
    </nav>
  );
}

// Recorta la página pedida y la corrige si viene fuera de rango: ?p=999 debe
// mostrar la última página con productos, no una cuadrícula vacía.
export function paginar<T>(items: T[], pedida: number) {
  const paginas = Math.max(1, Math.ceil(items.length / POR_PAGINA));
  const pagina = Math.min(Math.max(1, pedida || 1), paginas);
  return { pagina, items: items.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA) };
}
