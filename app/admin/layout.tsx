import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { AngleJobsProvider } from "@/components/providers/AngleJobsProvider";
import { GlobalJobProgress } from "@/components/admin/GlobalJobProgress";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/login");

  return (
    <AngleJobsProvider>
      <GlobalJobProgress />
      <div className="py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <nav className="flex items-center gap-1 text-sm">
          <span className="mr-3 font-semibold tracking-tight">Admin</span>
          {[
            ["/admin", "Inicio"],
            ["/admin/orders", "Pedidos"],
            ["/admin/products", "Productos"],
            ["/admin/inventory", "Inventario"],
            ["/admin/ajustes", "Ajustes"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full px-3 py-1.5 text-muted transition-colors hover:text-text">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-muted transition-colors hover:text-text">Ver tienda</Link>
          <form action={signOut}>
            <button className="rounded-full border border-border px-3 py-1.5 text-muted transition-colors hover:text-text">
              Salir
            </button>
          </form>
        </div>
      </div>
      {children}
      </div>
    </AngleJobsProvider>
  );
}
