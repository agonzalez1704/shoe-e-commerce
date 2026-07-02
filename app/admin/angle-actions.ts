"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { startAngleGeneration, getAngleSet, refineLogo } from "@/lib/autotoon";
import { completeReadyJob, failJob } from "@/lib/angle-complete";
import { rehostImages } from "@/lib/rehost";
import { activeBrand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";

const WEBHOOK_URL = `${SITE_URL}/api/webhooks/auto-toon`;

// Kick off an auto-toon job and record it. Returns fast — completion arrives via
// the webhook, which updates the row and Realtime pushes it to the admin UI.
export async function startAngleJob(
  sourceUrl: string,
  productName: string,
  productId?: string,
): Promise<{ jobId: string } | { error: string }> {
  const supabase = await requireAdmin();
  const secret = process.env.AUTOTOON_WEBHOOK_SECRET;
  if (!secret) return { error: "AUTOTOON_WEBHOOK_SECRET no configurado." };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const toonSetId = await startAngleGeneration(sourceUrl, productName || "producto", {
      webhookUrl: WEBHOOK_URL,
      webhookSecret: secret,
    });

    const { data, error } = await supabase
      .from("angle_jobs")
      .insert({
        toon_set_id: toonSetId,
        product_id: productId ?? null,
        product_name: productName || null,
        source_url: sourceUrl,
        status: "processing",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { jobId: data.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al iniciar la generación" };
  }
}

// Dismiss a finished job: delete the row so it doesn't reappear on the next
// hydrate/Realtime tick. Only terminal jobs should be dismissed from the UI.
export async function dismissAngleJob(jobId: string): Promise<void> {
  const supabase = await requireAdmin();
  await supabase.from("angle_jobs").delete().eq("id", jobId);
}

// Logo correction on a single image using the active brand's logo (auto-toon).
// Synchronous (~60-90s); returns the re-hosted refined image url.
export async function refineImageLogo(imageUrl: string): Promise<{ url: string } | { error: string }> {
  const supabase = await requireAdmin();
  // prefer the logo uploaded in admin settings; fall back to the brand asset
  const { data: cfg } = await supabase.from("settings").select("value").eq("key", "refine_logo_url").maybeSingle();
  const configured = cfg?.value ?? activeBrand.refineLogoUrl ?? null;
  if (!configured) return { error: "No hay logo configurado. Súbelo en Ajustes." };
  const logoUrl = configured.startsWith("http") ? configured : `${SITE_URL}${configured}`;
  try {
    const refined = await refineLogo(imageUrl, logoUrl);
    const [hosted] = await rehostImages([refined]);
    if (!hosted) return { error: "No se pudo alojar la imagen refinada." };
    return { url: hosted };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al corregir el logo" };
  }
}

// The webhook is fire-and-forget with no retry, so the client reconciles: while
// a job is processing it periodically pulls the set state from auto-toon and
// finalizes the job itself. This makes completion reliable even if the webhook
// is lost. The atomic claim in completeReadyJob prevents a double-attach if the
// webhook and a reconcile land together. Idempotent — safe to call repeatedly.
export async function reconcileJob(jobId: string): Promise<void> {
  const supabase = await requireAdmin();
  const { data: job } = await supabase
    .from("angle_jobs")
    .select("id, toon_set_id, status, product_id, product_name")
    .eq("id", jobId)
    .single();
  if (!job || job.status !== "processing") return;

  const set = await getAngleSet(job.toon_set_id);
  if (!set) return;
  if (set.status === "ready") await completeReadyJob(supabase, job, set.angleUrls ?? []);
  else if (set.status === "failed") await failJob(supabase, job.id, set.errorMessage ?? "auto-toon falló");
}
