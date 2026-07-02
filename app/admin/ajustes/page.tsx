import { getRefineLogoUrl } from "@/app/admin/settings-actions";
import { LogoSettings } from "@/components/admin/LogoSettings";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const logoUrl = await getRefineLogoUrl();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      <LogoSettings initialUrl={logoUrl} />
    </div>
  );
}
