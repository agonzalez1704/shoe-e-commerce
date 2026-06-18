import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role client. BYPASSES RLS. Server-only — never import in a client component.
// Use ONLY for trusted server work: Stripe webhook (commit_order/cancel_order),
// set_order_amounts, and guest create_order.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
