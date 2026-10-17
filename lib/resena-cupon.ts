import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { crearCodigoUnico } from "@/lib/codigos";
import { sendReviewCouponEmail } from "@/lib/email";
import { CUPON_RESENA } from "@/lib/reviews-shared";

// El 10% se gana con los dos pasos (reseña + foto etiquetada aprobada),
// cualquiera que sea la calificación: un cupón por pedido. El update
// condicional evita dos cupones si se aprueba dos veces a la vez.
export async function emitirCuponDeResena(
  admin: ReturnType<typeof createAdminClient>,
  order: { id: string; email: string; order_number: string; cupon_resena: string | null },
): Promise<string | null> {
  if (order.cupon_resena) return order.cupon_resena;
  const code = await crearCodigoUnico(admin, "GRACIAS", CUPON_RESENA.porcentaje, CUPON_RESENA.dias * 24);
  if (!code) return null;
  const { data: tomado } = await admin
    .from("orders")
    .update({ cupon_resena: code })
    .eq("id", order.id)
    .is("cupon_resena", null)
    .select("id");
  if (!tomado?.length) {
    await admin.from("discount_codes").update({ active: false }).eq("code", code);
    const { data } = await admin.from("orders").select("cupon_resena").eq("id", order.id).single();
    return data?.cupon_resena ?? null;
  }
  await sendReviewCouponEmail({ to: order.email, orderNumber: order.order_number, codigo: code });
  return code;
}
