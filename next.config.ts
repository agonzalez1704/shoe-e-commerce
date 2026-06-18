import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  images: {
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
