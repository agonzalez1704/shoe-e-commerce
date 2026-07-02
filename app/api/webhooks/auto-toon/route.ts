import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignature } from "@/lib/webhook-sig";
import { completeReadyJob, failJob } from "@/lib/angle-complete";

// auto-toon completion webhook. HMAC-verified; the heavy work (download + re-host
// 3 images, attach to the product) runs in after() so the response is instant —
// doing it synchronously tripped Vercel's resource limit (HTTP 508) and the
// completion was lost. The client poll reflects the row once after() finishes.
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

  // Respond instantly; do the download/re-host/attach in the background.
  after(async () => {
    if (body.status === "ready") await completeReadyJob(admin, job, body.angleUrls ?? []);
    else await failJob(admin, job.id, body.errorMessage ?? "auto-toon falló");
  });

  return NextResponse.json({ ok: true });
}
