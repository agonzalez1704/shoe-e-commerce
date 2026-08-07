import { slugifyColor } from "@/lib/meta-content";
import { cdnImage } from "@/lib/cdn-image";

// Pre-rendered 1200x630 JPEG share cards live in Storage under og/.
// They exist because the product photos are portrait WebP: link previews crop
// them badly, and Meta/WhatsApp don't reliably decode WebP. Generated per
// colourway, with a per-product fallback.
//   og/{slug}--{colourslug}.jpg   ·   og/{slug}.jpg
export function ogCardUrl(slug: string, color?: string): string {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/og`;
  const cs = color ? slugifyColor(color) : "";
  // Served through Vercel: every WhatsApp and Facebook share preview fetches
  // this URL directly, and pointing it at Storage billed each one to Supabase.
  return cdnImage(cs ? `${base}/${slug}--${cs}.jpg` : `${base}/${slug}.jpg`);
}
