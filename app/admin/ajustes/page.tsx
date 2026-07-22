import { getRefineLogoUrl } from "@/app/admin/settings-actions";
import { listTeam } from "@/app/admin/team-actions";
import { LogoSettings } from "@/components/admin/LogoSettings";
import { TeamSettings } from "@/components/admin/TeamSettings";
import { MetaTest } from "@/components/admin/MetaTest";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
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
