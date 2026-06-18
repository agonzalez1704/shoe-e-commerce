"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Browser client. Carries the user's session -> RLS applies as that user.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
