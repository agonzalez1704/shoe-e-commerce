import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Los pedidos de invitado guardan el correo pero no el cliente: quien compra
// sin cuenta y después entra no veía nada en "Mi cuenta". Se ligan por correo,
// solo con correo confirmado — si no, cualquiera que registre un correo ajeno
// vería direcciones y teléfonos de pedidos que no son suyos. Google llega con
// el correo confirmado; el registro con contraseña exige confirmarlo antes.
export async function ligarPedidosDeInvitado(user: User): Promise<void> {
  if (!user.email || !user.email_confirmed_at) return;
  const { error } = await createAdminClient()
    .from("orders")
    .update({ customer_id: user.id })
    .is("customer_id", null)
    .ilike("email", user.email.replace(/[\\%_]/g, "\\$&"));
  if (error) console.error("[cuenta] ligar pedidos:", error.message);
}
