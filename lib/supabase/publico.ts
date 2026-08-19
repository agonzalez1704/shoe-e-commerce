import { createClient as createSupabase } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Cliente ANÓNIMO y sin cookies, para lecturas públicas dentro de `'use cache'`.
//
// El cliente de servidor normal lee cookies() para cargar la sesión, y eso
// vuelve dinámica cualquier función que lo use: con cacheComponents, una
// lectura de catálogo que pasaba por ahí bloqueaba el prerender de la ruta
// entera. El catálogo, las categorías y las noticias son públicos — RLS ya
// los limita a lo publicado — así que no necesitan sesión para leerse.
//
// NUNCA usarlo para datos del usuario: sin cookies no hay RLS por usuario.
export function createPublicClient() {
  return createSupabase<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
