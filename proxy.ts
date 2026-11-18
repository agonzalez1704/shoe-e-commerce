import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request so RLS sees a valid JWT.
// Named `proxy` since Next 16 — the `middleware` convention is deprecated.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  // "Usar mi crédito" (correo y página del pedido) llega con ?credito=CODIGO a la
  // tienda: se guarda y el checkout lo aplica solo cuando el carrito ya tenga pares.
  const credito = request.nextUrl.searchParams.get("credito")?.trim().toUpperCase();
  if (credito && /^[A-Z0-9-]{3,30}$/.test(credito)) {
    response.cookies.set("codigo_pendiente", credito, { maxAge: 30 * 86400, httpOnly: true, sameSite: "lax", path: "/" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
