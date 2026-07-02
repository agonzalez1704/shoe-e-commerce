"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { startAngleGeneration, getAngleSet } from "@/lib/autotoon";
import { rehostImages } from "@/lib/rehost";
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

// Fallback if a webhook is ever missed: pull the set state from auto-toon and
// finalize the job ourselves. Safe to call repeatedly (idempotent on terminal).
export async function reconcileJob(jobId: string): Promise<void> {
  const supabase = await requireAdmin();
  const { data: job } = await supabase
    .from("angle_jobs")
    .select("id, toon_set_id, status")
    .eq("id", jobId)
    .single();
  if (!job || job.status !== "processing") return;

  const set = await getAngleSet(job.toon_set_id);
  if (!set) return;
  if (set.status === "ready") {
    const urls = await rehostImages(set.angleUrls ?? []);
    await supabase.from("angle_jobs").update({ status: "ready", result_urls: urls }).eq("id", jobId);
  } else if (set.status === "failed") {
    await supabase.from("angle_jobs").update({ status: "failed", error: set.errorMessage ?? "auto-toon falló" }).eq("id", jobId);
  }
}
