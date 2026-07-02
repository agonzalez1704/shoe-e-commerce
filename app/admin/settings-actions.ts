"use server";

import { requireAdmin } from "@/lib/admin-guard";

const REFINE_LOGO_KEY = "refine_logo_url";

export async function getRefineLogoUrl(): Promise<string | null> {
  const supabase = await requireAdmin();
  const { data } = await supabase.from("settings").select("value").eq("key", REFINE_LOGO_KEY).maybeSingle();
  return data?.value ?? null;
}

export async function saveRefineLogoUrl(url: string): Promise<void> {
  const supabase = await requireAdmin();
  await supabase
    .from("settings")
    .upsert({ key: REFINE_LOGO_KEY, value: url, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
