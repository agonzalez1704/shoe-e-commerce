import { SITE_URL } from "@/lib/site";

/**
 * Route an image through Vercel's optimizer instead of handing out the raw
 * Supabase Storage URL.
 *
 * Everything a browser renders already goes through <Image>, so Vercel fetches
 * each source once per `minimumCacheTTL` (30 days) and serves the rest from its
 * own CDN. The two places that bypassed it were the ones nothing renders: the
 * Meta catalog feed's `image_link` and the `og:image` share cards. Those are
 * fetched directly by Meta, WhatsApp and every other crawler, which is how a
 * 6 MB bucket produced 73 GB of Supabase egress in twenty days and took the
 * project past its quota.
 *
 * Absolute because crawlers have no page to resolve a relative URL against.
 */
export function cdnImage(src: string, width = 1200, quality = 75): string {
  if (!src) return "";
  // already ours, or a data URI — nothing to route
  if (src.startsWith("data:") || src.includes("/_next/image")) return src;
  return `${SITE_URL}/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}
