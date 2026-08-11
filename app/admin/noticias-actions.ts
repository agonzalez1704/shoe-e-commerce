"use server";

import { revalidatePath } from "next/cache";
import { requirePermiso } from "@/lib/permisos-guard";

export type NoticiaInput = {
  id?: string;
  slug: string;
  titulo: string;
  categoria: string;
  coverUrl: string;
  cuerpo: string;
  publicada: boolean;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Devuelve {ok,error} en vez de lanzar: Next borra el mensaje de un throw en
// producción y el admin sólo vería "error 441". Ya nos pasó con Skydropx.
export async function guardarNoticia(input: NoticiaInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await requirePermiso("contenido_gestionar");

  const titulo = input.titulo.trim();
  if (!titulo) return { ok: false, error: "El título es obligatorio" };
  const slug = (input.slug.trim() || slugify(titulo)).slice(0, 80);
  if (!slug) return { ok: false, error: "No se pudo derivar un slug del título" };

  const fila = {
    slug,
    titulo,
    categoria: input.categoria.trim() || null,
    cover_url: input.coverUrl.trim() || null,
    cuerpo: input.cuerpo.trim() || null,
    // Publicar es sellar la fecha; despublicar es borrarla. Una sola columna
    // lleva el estado, el orden y la fecha que se muestra.
    published_at: input.publicada ? new Date().toISOString() : null,
  };

  const q = input.id
    ? await supabase.from("noticias").update(fila).eq("id", input.id)
    : await supabase.from("noticias").insert(fila);

  if (q.error) {
    return { ok: false, error: q.error.message.includes("duplicate") ? "Ese slug ya existe" : q.error.message };
  }

  revalidatePath("/admin/noticias");
  revalidatePath("/noticias");
  revalidatePath("/");
  return { ok: true };
}

export async function eliminarNoticia(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await requirePermiso("contenido_gestionar");
  const { error } = await supabase.from("noticias").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/noticias");
  revalidatePath("/noticias");
  revalidatePath("/");
  return { ok: true };
}
