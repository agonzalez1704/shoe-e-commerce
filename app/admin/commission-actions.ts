"use server";

import { revalidatePath } from "next/cache";
import { requirePermiso } from "@/lib/permisos-guard";

// Paying the dev is two-step: whoever pays marks the orders, and the dev
// confirms they received it. The dev marking skips straight to confirmed.

export async function markCommissionPaid(orderIds: string[]): Promise<void> {
  const supabase = await requirePermiso("comisiones_ver");
  if (!orderIds.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  const { data: dev } = await supabase.rpc("is_dev");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({
      dev_commission_marked_at: now,
      dev_commission_marked_by: user?.id ?? null,
      ...(dev ? { dev_commission_paid_at: now } : {}),
    })
    .in("id", orderIds);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/comisiones");
}

// Only the developer can confirm they were actually paid.
export async function confirmCommissionPaid(orderIds: string[]): Promise<void> {
  const supabase = await requirePermiso("comisiones_ver");
  const { data: dev } = await supabase.rpc("is_dev");
  if (!dev) throw new Error("Solo el desarrollador puede confirmar el pago");
  if (!orderIds.length) return;

  const { error } = await supabase
    .from("orders")
    .update({ dev_commission_paid_at: new Date().toISOString() })
    .in("id", orderIds);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/comisiones");
}

// Undo — the dev arbitrates, since they are the one being paid.
export async function resetCommission(orderIds: string[]): Promise<void> {
  const supabase = await requirePermiso("comisiones_ver");
  const { data: dev } = await supabase.rpc("is_dev");
  if (!dev) throw new Error("Solo el desarrollador puede revertir");
  if (!orderIds.length) return;

  const { error } = await supabase
    .from("orders")
    .update({ dev_commission_paid_at: null, dev_commission_marked_at: null, dev_commission_marked_by: null })
    .in("id", orderIds);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/comisiones");
}
