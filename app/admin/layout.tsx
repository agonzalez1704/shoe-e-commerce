import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { permisosDe, concede } from "@/lib/permisos-guard";
import { SITE_NAME } from "@/lib/site";
import type { Permiso } from "@/lib/permissions";
import { signOut } from "@/app/auth/actions";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { AngleJobsProvider } from "@/components/providers/AngleJobsProvider";
import { GlobalJobProgress } from "@/components/admin/GlobalJobProgress";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;


// installable admin PWA (its own manifest so the storefront is unaffected)
export const metadata: Metadata = {
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: `${SITE_NAME} Admin` },
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
    ["/admin/noticias", "Noticias", "contenido_gestionar"],
    ["/admin/metricas", "Métricas", "metricas_ver"],
    ["/admin/comisiones", "Comisiones", "comisiones_ver"],
    ["/admin/usuarios", "Usuarios", "usuarios_gestionar"],
    ["/admin/ajustes", "Ajustes", "ajustes_gestionar"],
  ];
  const nav = NAV.filter(([, , p]) => p === null || concede(perms, p));

  return (
    <AngleJobsProvider>
      <GlobalJobProgress />
      {/* sidebar + content. The rail only renders inside /admin, which is already
          gated above, so it never reaches a storefront visitor. */}
      {/* column on phones so the bar is a header, row on desktop so it's a rail */}
      <div className="flex flex-col gap-4 pb-6 md:flex-row md:gap-6 md:py-6">
        <AdminSidebar
          items={nav.map(([href, label]) => ({ href, label }))}
          signOut={
            <form action={signOut}>
              <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-elevated hover:text-text">
                <SignOut size={17} /> Salir
              </button>
            </form>
          }
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AngleJobsProvider>
  );
}
