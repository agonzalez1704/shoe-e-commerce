import "server-only";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
// Spoofable + shared via NAT — pair with the per-session pending-order cap.
export async function clientIp() {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  return xff?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

// true = allowed, false = over limit. Fails OPEN on limiter error so a DB hiccup
// never blocks real customers.
export async function rateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_bucket: bucket,
    p_identifier: identifier,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] error, failing open:", error.message);
    return true;
  }
  return data as boolean;
}
