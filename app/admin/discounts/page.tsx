import { createClient } from "@/lib/supabase/server";
import { DiscountCodes, type CodeRow } from "@/components/admin/DiscountCodes";

export const dynamic = "force-dynamic";

export default async function AdminDiscounts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("discount_codes")
    .select("id, code, type, value, min_subtotal_cents, max_uses, used_count, expires_at, active")
    .order("code");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Códigos de descuento</h1>
        <span className="text-sm text-muted">{(data ?? []).length} códigos</span>
      </div>
      <DiscountCodes rows={(data ?? []) as CodeRow[]} />
    </div>
  );
}
