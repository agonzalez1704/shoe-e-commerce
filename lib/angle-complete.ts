import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rehostImages } from "@/lib/rehost";

type Client = SupabaseClient<Database>;
type Job = { id: string; product_id: string | null; product_name: string | null };

// Finalize a READY angle job: re-host the images, atomically CLAIM the row (so
// the webhook and the client-side reconcile can't both attach), then attach the
// images to the product. Shared by the webhook and reconcileJob so completion is
// reliable regardless of which path arrives first.
export async function completeReadyJob(client: Client, job: Job, angleUrls: string[]): Promise<void> {
  const urls = await rehostImages(angleUrls);

  // claim: only the first finisher flips processing -> ready
  const { data: claimed } = await client
    .from("angle_jobs")
    .update(
      urls.length
        ? { status: "ready", result_urls: urls }
        : { status: "failed", error: "No se pudieron alojar las imágenes." },
    )
    .eq("id", job.id)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (!claimed) return; // the other path already finalized it

  if (!urls.length || !job.product_id) return;
  const productId = job.product_id;
  const { count } = await client
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  const base = count ?? 0;
  await client.from("product_images").insert(
    urls.map((url, i) => ({ product_id: productId, url, alt: job.product_name, position: base + i })),
  );
}

// Mark a job failed (idempotent: only if still processing).
export async function failJob(client: Client, jobId: string, error: string): Promise<void> {
  await client.from("angle_jobs").update({ status: "failed", error }).eq("id", jobId).eq("status", "processing");
}
