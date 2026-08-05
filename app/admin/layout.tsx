import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { permisosDe, concede } from "@/lib/permisos-guard";
import type { Permiso } from "@/lib/permissions";
import { signOut } from "@/app/auth/actions";
import { AngleJobsProvider } from "@/components/providers/AngleJobsProvider";
import { GlobalJobProgress } from "@/components/admin/GlobalJobProgress";

export const dynamic = "force-dynamic";

// installable admin PWA (its own manifest so the storefront is unaffected)
export const metadata: Metadata = {
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Blade Admin" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // entry is staff membership; what they can DO comes from their role's permissions
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) redirect("/login");
  const perms = await permisosDe();

  const NAV: [string, string, Permiso | null][] = [
    ["/admin", "Inicio", null],
    ["/admin/orders", "Pedidos", "pedidos_ver"],
    ["/admin/products", "Productos", "productos_gestionar"],
    ["/admin/inventory", "Inventario", "inventario_ver"],
    ["/admin/discounts", "Descuentos", "descuentos_gestionar"],
    ["/admin/promociones", "Promociones", "promociones_gestionar"],
    ["/admin/metricas", "Métricas", "metricas_ver"],
    ["/admin/comisiones", "Comisiones", "comisiones_ver"],
    ["/admin/usuarios", "Usuarios", "usuarios_gestionar"],
    ["/admin/ajustes", "Ajustes", "ajustes_gestionar"],
  ];
  const nav = NAV.filter(([, , p]) => p === null || concede(perms, p));

  return (
    <AngleJobsProvider>
      <GlobalJobProgress />
      <div className="py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        {/* links don't fit a phone: the nav scrolls on its own (w-full + min-w-0),
            no negative margins that would push the whole page sideways */}
        <nav className="flex w-full min-w-0 items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none] sm:w-auto [&::-webkit-scrollbar]:hidden">
          <span className="mr-3 shrink-0 font-semibold tracking-tight">Admin</span>
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="shrink-0 rounded-full px-3 py-1.5 text-muted transition-colors hover:text-text">
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
