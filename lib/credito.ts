import "server-only";

import { crearCodigoUnico } from "@/lib/codigos";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Credito } from "@/lib/email";

// Crédito para la siguiente compra (docs/CREDITO-BLADE.md): monto fijo, un uso,
// compartible, se suma al combo.
export const CREDITO = { montoCents: 15000, dias: 30, avisoDias: 5 };

// Emite el crédito de un pedido pagado. Los complementos del combo no generan
// (ya son precio especial). null si no aplica o no se pudo crear.
export async function emitirCredito(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
): Promise<Credito | null> {
  const { data: o } = await admin
    .from("orders")
    .select("credito_codigo, combo_parent_order_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!o || o.combo_parent_order_id || o.credito_codigo) return null;

  const codigo = await crearCodigoUnico(admin, "CREDITO", CREDITO.montoCents, CREDITO.dias * 24, null, "fixed");
  if (!codigo) return null;
  await admin.from("orders").update({ credito_codigo: codigo }).eq("id", orderId);
  return { codigo, montoCents: CREDITO.montoCents, venceIso: new Date(Date.now() + CREDITO.dias * 86400_000).toISOString() };
}

// Crédito vigente de un pedido (sin usar, activo, sin vencer), para mostrarlo.
export async function creditoVigente(
  admin: ReturnType<typeof createAdminClient>,
  orderNumber: string,
): Promise<Credito | null> {
  const { data: o } = await admin.from("orders").select("credito_codigo").eq("order_number", orderNumber).maybeSingle();
  if (!o?.credito_codigo) return null;
  const { data: c } = await admin
    .from("discount_codes")
    .select("code, value, expires_at, used_count, active")
    .eq("code", o.credito_codigo)
    .maybeSingle();
  if (!c?.active || c.used_count > 0 || !c.expires_at || new Date(c.expires_at).getTime() < Date.now()) return null;
  return { codigo: c.code, montoCents: c.value, venceIso: c.expires_at };
}
