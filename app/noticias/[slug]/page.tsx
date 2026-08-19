import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getNoticia, fechaNoticia } from "@/lib/noticias";


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const n = await getNoticia(slug);
  if (!n) return { title: "No encontrado" };
  return {
    title: n.titulo,
    description: n.cuerpo?.slice(0, 155) ?? n.titulo,
    alternates: { canonical: `/noticias/${slug}` },
    openGraph: { title: n.titulo, images: n.cover_url ? [n.cover_url] : undefined },
  };
}

export default async function NoticiaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = await getNoticia(slug);
  if (!n) notFound();

  return (
    <article className="py-10">
      <nav className="mb-6 flex items-center gap-1 text-xs text-muted">
        <Link href="/noticias" className="transition-colors hover:text-text">Noticias</Link>
        <CaretRight size={12} />
        <span className="text-text">{n.titulo}</span>
      </nav>

      {n.categoria && (
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">{n.categoria}</span>
      )}
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{n.titulo}</h1>
      <p className="nums mt-2 text-sm text-muted">{fechaNoticia(n.published_at)}</p>

      {n.cover_url && (
        <div className="relative mt-7 aspect-[16/9] overflow-hidden rounded-2xl bg-elevated ring-1 ring-border/60">
          <Image src={n.cover_url} alt="" fill sizes="100vw" className="object-cover" priority />
        </div>
      )}

      {/* Texto plano con saltos de línea: el formulario del admin es un textarea,
          no un editor rico, así que renderizar HTML aquí sería aceptar markup
          que nadie escribió a propósito. */}
      {n.cuerpo && (
        <div className="mt-7 max-w-prose space-y-4 text-sm leading-relaxed text-muted sm:text-base">
          {n.cuerpo.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
    </article>
  );
}
