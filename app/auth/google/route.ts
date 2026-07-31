import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Start Google OAuth server-side so the button is a plain link. iOS Safari blocks
// the client SDK's post-await window.location redirect (lost user activation); a
// top-level navigation to this route + a 302 to Google is never blocked. The
// PKCE verifier cookie is set on the redirect response by the SSR client.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const next = searchParams.get("next") ?? "/cuenta";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    console.error("[auth/google] signInWithOAuth failed:", error?.message);
    return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(data.url);
}
