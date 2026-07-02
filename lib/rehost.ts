import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "product-images";

// SSRF guard: only fetch https URLs on public hosts. The URLs arrive in an
// HMAC-verified webhook, but never let a fetch target localhost/private ranges.
function isFetchable(u: string): boolean {
  let p: URL;
  try { p = new URL(u); } catch { return false; }
  if (p.protocol !== "https:") return false;
  const h = p.hostname;
  return !(
    h === "localhost" || h === "0.0.0.0" || h === "::1" || h.endsWith(".local") ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^169\.254\./.test(h)
  );
}

// Copy externally-hosted images (e.g. auto-toon's R2 URLs) into our own bucket
// so they survive the provider's retention and serve from our domain. Returns
// the new public URLs (skips any that fail the SSRF guard / fetch / upload).
export async function rehostImages(urls: string[], prefix = "ai"): Promise<string[]> {
  const admin = createAdminClient();
  const out: string[] = [];
  for (const url of urls) {
    if (!isFetchable(url)) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") ?? "image/jpeg";
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
      const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: ct });
      if (error) continue;
      out.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    } catch {
      // skip this one; keep going
    }
  }
  return out;
}
