import type { NextConfig } from "next";
import path from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;

const nextConfig: NextConfig = {
  // Instant Navigations (Next 16.3): shell prerenderizado por ruta + prefetch
  // parcial en <Link> visibles. Los loading.tsx existentes son los fallbacks
  // que integran ese shell.
  cacheComponents: true,
  partialPrefetching: true,
  // Next 16 builds with Turbopack, which infers the workspace root from the
  // nearest lockfile — and there is a stray package-lock.json in ~/Sites, one
  // level above this repo. Pin it so resolution never walks out of the project.
  turbopack: { root: path.resolve(__dirname) },
  // Next 16 dropped `experimental.viewTransition`; only blockingSSR / taint /
  // transitionIndicator / gestureTransition still pull in react@experimental,
  // which is what supplied `unstable_ViewTransition`. Our <ViewTransition>
  // already degrades to a passthrough, so the page morph is simply off.
  images: {
    // Vercel caches each optimized image for this long before re-fetching the
    // source from Supabase Storage. Long TTL keeps Supabase egress near zero
    // (the free tier's 5 GB cap) — the source barely changes.
    minimumCacheTTL: 2_592_000, // 30 days
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // derive protocol from the URL — local stack is http://127.0.0.1, prod is https
      ...(supabaseUrl
        ? [
            {
              protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
              hostname: supabaseUrl.hostname,
              port: supabaseUrl.port || undefined,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // seed placeholder images — remove once real product images are uploaded
      { protocol: "https" as const, hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
