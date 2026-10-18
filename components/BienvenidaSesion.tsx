import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CuentaBienvenida } from "@/components/CuentaBienvenida";
import { AvisoResena } from "@/components/AvisoResena";

// La lectura de sesión (cookies) vive aquí, aislada bajo Suspense, y no en el
// layout raíz: ahí volvía dinámico el shell de TODAS las rutas y bloqueaba el
// prerender con cacheComponents. La barra no es parte del primer pintado — un
// fallback null es exactamente lo que debe verse mientras se resuelve.
async function ConSesion() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  // Con sesión, en vez del gancho para crear cuenta: el aviso del 10% por reseñar.
  return user ? <AvisoResena /> : <CuentaBienvenida conSesion={false} />;
}

export function BienvenidaSesion() {
  return (
    <Suspense fallback={null}>
      <ConSesion />
    </Suspense>
  );
}
