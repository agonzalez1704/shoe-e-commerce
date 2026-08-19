import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/publico";
import { cacheLife, cacheTag } from "next/cache";

export type Noticia = {
  slug: string;
  titulo: string;
  categoria: string | null;
  cover_url: string | null;
  cuerpo: string | null;
  published_at: string | null;
};

// Los borradores y las programadas a futuro las filtra la RLS, no esta consulta
// — así el filtro vive en un solo sitio y no se puede olvidar en una ruta nueva.
export const listNoticias = cache(async (limit = 12): Promise<Noticia[]> => {
  "use cache";
  cacheLife("minutes");
  cacheTag("noticias");
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("noticias")
    .select("slug, titulo, categoria, cover_url, cuerpo, published_at")
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data as Noticia[]) ?? [];
});

export const getNoticia = cache(async (slug: string): Promise<Noticia | null> => {
  "use cache";
  cacheLife("minutes");
  cacheTag("noticias");
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("noticias")
    .select("slug, titulo, categoria, cover_url, cuerpo, published_at")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Noticia) ?? null;
});

export function fechaNoticia(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}
