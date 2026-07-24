import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);

// First-party analytics ingest. Public POST (it's just visit data), rate-limited,
// service-role insert so no public write policy is exposed.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const type = body.type === "click" ? "click" : body.type === "pageview" ? "pageview" : null;
  const path = str(body.path, 300);
  const sessionId = str(body.sid, 60);
  if (!type || !path || !sessionId) return NextResponse.json({ ok: false }, { status: 400 });
  if (path.startsWith("/admin") || path.startsWith("/api")) return NextResponse.json({ ok: true }); // don't track ourselves

  // generous cap: a browsing session fires many events; this only stops flooding
  const ip = await clientIp();
  if (!(await rateLimit("track", ip, 240, 60))) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  await admin.from("analytics_events").insert({
    session_id: sessionId,
    type,
    path,
    referrer: str(body.referrer, 300),
    source: str(body.source, 200),
    target: str(body.target, 200),
    device: body.device === "mobile" ? "mobile" : "desktop",
  });

  return NextResponse.json({ ok: true });
}
