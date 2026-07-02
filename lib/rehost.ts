import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "product-images";

// Copy externally-hosted images (e.g. auto-toon's R2 URLs) into our own bucket
// so they survive the provider's retention and serve from our domain. Returns
// the new public URLs (skips any that fail to fetch/upload).
export async function rehostImages(urls: string[], prefix = "ai"): Promise<string[]> {
  const admin = createAdminClient();
  const out: string[] = [];
  for (const url of urls) {
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
