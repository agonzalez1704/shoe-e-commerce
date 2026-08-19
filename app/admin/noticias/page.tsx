import { createClient } from "@/lib/supabase/server";
import { NoticiasView } from "@/components/admin/NoticiasView";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;


export default async function AdminNoticias() {
  const supabase = await createClient();
  // Sin filtro de publicación: la RLS ya deja ver los borradores a quien tiene
  // contenido_gestionar, y el admin necesita verlos.
  const { data } = await supabase
    .from("noticias")
    .select("id, slug, titulo, categoria, cover_url, cuerpo, published_at")
    .order("created_at", { ascending: false });
  return <NoticiasView noticias={data ?? []} />;
}
