import { getRefineLogoUrl } from "@/app/admin/settings-actions";
import { listTeam } from "@/app/admin/team-actions";
import { LogoSettings } from "@/components/admin/LogoSettings";
import { TeamSettings } from "@/components/admin/TeamSettings";
import { MetaTest } from "@/components/admin/MetaTest";
import { requirePagePermiso } from "@/lib/permisos-guard";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;


export default async function AjustesPage() {
  await requirePagePermiso("ajustes_gestionar");
  const [logoUrl, team] = await Promise.all([getRefineLogoUrl(), listTeam()]);
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      <TeamSettings members={team} />
      <MetaTest />
      <LogoSettings initialUrl={logoUrl} />
    </div>
  );
}
