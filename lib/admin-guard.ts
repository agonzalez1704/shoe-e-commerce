import "server-only";

import { createClient } from "@/lib/supabase/server";

// Verify the caller is an admin and return the RLS-scoped server client.
// Use in every admin server action — UI gating is not access control.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("forbidden");
  return supabase;
}
