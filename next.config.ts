import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
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
