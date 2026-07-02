import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignature } from "@/lib/webhook-sig";
import { rehostImages } from "@/lib/rehost";

// auto-toon completion webhook. HMAC-verified, then finalizes the matching
// angle_jobs row (service_role); Supabase Realtime pushes it to the admin UI.
export const dynamic = "force-dynamic";

type Payload = {
  angleSetId: string;
  status: string;
  angleUrls?: string[];
  errorMessage?: string | null;
};

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.AUTOTOON_WEBHOOK_SECRET ?? "";
  if (!verifySignature(secret, raw, req.headers.get("x-webhook-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: Payload;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  // only terminal states matter; ack anything else
  if (body.status !== "ready" && body.status !== "failed") {
    return NextResponse.json({ ok: true, ignored: body.status });
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("angle_jobs")
    .select("id, status, product_id, product_name")
    .eq("toon_set_id", body.angleSetId)
    .single();
  if (!job) return NextResponse.json({ ok: true, unknown: true }); // ack; nothing to do
  if (job.status !== "processing") return NextResponse.json({ ok: true, already: job.status }); // idempotent

  if (body.status === "ready") {
    const urls = await rehostImages(body.angleUrls ?? []);
    await admin
      .from("angle_jobs")
      .update(urls.length ? { status: "ready", result_urls: urls } : { status: "failed", error: "No se pudieron alojar las imágenes." })
      .eq("id", job.id);

    // attach to the product so the images land in the UI regardless of whether
    // the edit form is still open (the form-append path is a live bonus only).
    const productId = job.product_id;
    if (urls.length && productId) {
      const { count } = await admin
        .from("product_images")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId);
      const base = count ?? 0;
      await admin.from("product_images").insert(
        urls.map((url, i) => ({ product_id: productId, url, alt: job.product_name, position: base + i })),
      );
    }
  } else {
    await admin
      .from("angle_jobs")
      .update({ status: "failed", error: body.errorMessage ?? "auto-toon falló" })
      .eq("id", job.id);
  }

  return NextResponse.json({ ok: true });
}
