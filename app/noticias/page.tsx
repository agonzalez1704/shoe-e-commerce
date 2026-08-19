import type { Metadata } from "next";
import { listNoticias } from "@/lib/noticias";
import { NoticiaCard } from "@/components/NoticiasBand";
import { activeBrand } from "@/lib/brand";


export const metadata: Metadata = {
  title: "Noticias y eventos",
  description: `Novedades, lanzamientos y eventos de ${activeBrand.name}.`,
  alternates: { canonical: "/noticias" },
};

export default async function NoticiasPage() {
  const noticias = await listNoticias(24);
  return (
    <div className="py-10">
      <h1 className="text-3xl font-semibold uppercase tracking-tight sm:text-4xl">Noticias y eventos</h1>
      {noticias.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Todavía no hay publicaciones.</p>
      ) : (
        <ul className="mt-8 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {noticias.map((n) => (
            <li key={n.slug}><NoticiaCard n={n} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
