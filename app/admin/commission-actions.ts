"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-guard";

// Mark (or unmark) the dev commission as paid for a set of orders.
export async function setCommissionPaid(orderIds: string[], paid: boolean): Promise<void> {
  await requireAdmin();
  if (!orderIds.length) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ dev_commission_paid_at: paid ? new Date().toISOString() : null })
    .in("id", orderIds);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/comisiones");
}
