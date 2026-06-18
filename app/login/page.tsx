import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "@/app/auth/actions";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

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

      <form action={signIn} className="mt-8 space-y-3">
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
