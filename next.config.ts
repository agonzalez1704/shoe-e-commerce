import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  images: {
    // How long an optimised image lives before the optimiser goes back to
    // Storage for the original. Next takes whichever is longer, this or the
    // upstream max-age, so a long floor here also covers the objects already
    // uploaded with the old one-hour header. Safe because a replaced photo gets
    // a new UUID path rather than overwriting the old one.
    minimumCacheTTL: 31536000,
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
