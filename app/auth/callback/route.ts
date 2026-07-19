import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth (Google) redirect target: exchange the code for a session, then bounce
// back to wherever the user started (?next=), defaulting to the account page.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/cuenta";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
