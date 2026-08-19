"use server";

import { updateTag } from "next/cache";

import { requirePermiso } from "@/lib/permisos-guard";

const REFINE_LOGO_KEY = "refine_logo_url";

export async function getRefineLogoUrl(): Promise<string | null> {
  const supabase = await requirePermiso("ajustes_gestionar");
  const { data } = await supabase.from("settings").select("value").eq("key", REFINE_LOGO_KEY).maybeSingle();
  return data?.value ?? null;
}

export async function saveRefineLogoUrl(url: string): Promise<void> {
  const supabase = await requirePermiso("ajustes_gestionar");
  await supabase
    .from("settings")
    .upsert({ key: REFINE_LOGO_KEY, value: url, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
