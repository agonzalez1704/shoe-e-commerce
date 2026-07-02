import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Shared HMAC-SHA256 webhook signing/verification. One implementation for every
// inbound webhook (auto-toon, Kapso, …) instead of a copy per route.

export function signBody(secret: string, raw: string): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

/** Constant-time verify of a hex HMAC signature against the raw request body. */
export function verifySignature(secret: string, raw: string, signature: string | null): boolean {
  if (!secret || !signature) return false;
  const expected = signBody(secret, raw);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
