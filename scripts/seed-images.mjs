// Idempotent product-image seeder. Uploads repo images (supabase/seed-images/)
// to Storage at stable paths and repoints product_images by product slug.
// Run after `supabase db reset` so shoe photos always survive a reseed.
//   node --env-file=.env.local scripts/seed-images.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !SK) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const BUCKET = "product-images";
const DIR = "supabase/seed-images";
const auth = { apikey: SK, Authorization: `Bearer ${SK}` };
const ctype = (e) => (e === ".png" ? "image/png" : e === ".webp" ? "image/webp" : "image/jpeg");

// group files by slug: "<slug>-<n>.<ext>"
const groups = {};
for (const file of readdirSync(DIR)) {
  const m = file.match(/^(.*)-(\d+)\.(\w+)$/);
  if (!m) continue;
  (groups[m[1]] ??= []).push({ file, n: Number(m[2]) });
}

for (const [slug, files] of Object.entries(groups)) {
  files.sort((a, b) => a.n - b.n);

  const res = await fetch(`${SB}/rest/v1/products?slug=eq.${slug}&select=id`, { headers: auth });
  const [product] = await res.json();
  if (!product) {
    console.warn(`! no product for slug ${slug}, skipping`);
    continue;
  }

  const urls = [];
  for (const { file } of files) {
    const ext = extname(file);
    const objectPath = `seed/${file}`;
    const up = await fetch(`${SB}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": ctype(ext), "x-upsert": "true" },
      body: readFileSync(join(DIR, file)),
    });
    if (!up.ok) {
      console.error(`  upload fail ${file}: ${up.status} ${await up.text()}`);
      continue;
    }
    urls.push(`${SB}/storage/v1/object/public/${BUCKET}/${objectPath}`);
  }

  await fetch(`${SB}/rest/v1/product_images?product_id=eq.${product.id}`, { method: "DELETE", headers: auth });
  const rows = urls.map((url, i) => ({ product_id: product.id, url, position: i, color: null }));
  if (rows.length) {
    await fetch(`${SB}/rest/v1/product_images`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
  }
  console.log(`✓ ${slug}: ${rows.length} images`);
}
console.log("done");
