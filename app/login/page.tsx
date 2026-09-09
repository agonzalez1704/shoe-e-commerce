import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "@/app/auth/actions";
import { SITE_NAME } from "@/lib/site";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export const instant = false; // dinámica de punta a punta (sesión/pedido)


export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // already an admin? skip the form
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin) redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-sm py-20">
      <h1 className="text-2xl font-semibold tracking-tight">Acceso staff</h1>
      <p className="mt-1 text-sm text-muted">Panel de administración {SITE_NAME}</p>

      {/* Entrar con la sesion de Google del dispositivo: el staff olvida la
          contraseña del panel mas seguido de lo que la usa. El permiso sigue
          siendo is_admin/is_staff — un Google ajeno entra como cliente, no aqui. */}
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1" && (
        <div className="mt-8">
          <GoogleSignInButton next="/admin" label="Entrar con Google" />
          <div className="my-4 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" /> o con contraseña <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <form action={signIn} className={process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1" ? "space-y-3" : "mt-8 space-y-3"}>
        <input
          name="email"
          type="email"
          placeholder="Correo"
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-text"
        />
        <input
          name="password"
          type="password"
          placeholder="Contraseña"
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-text"
        />
        {error && <p className="text-sm text-accent">{error}</p>}
        <button className="w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast transition-transform active:scale-[0.99]">
          Entrar
        </button>
      </form>
    </div>
  );
}
