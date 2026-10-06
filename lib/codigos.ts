import "server-only";

import { randomInt } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

// Codigo de un solo uso que se suma al combo. Sin letras que se confunden
// (0/O, 1/I/L) porque la gente lo copia a mano. null si no se pudo crear.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export async function crearCodigoUnico(
  admin: ReturnType<typeof createAdminClient>,
  prefijo: string,
  porcentaje: number,
  horas: number,
): Promise<string | null> {
  for (let intento = 0; intento < 3; intento++) {
    const code = `${prefijo}-` + Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
    const { error } = await admin.from("discount_codes").insert({
      code, type: "percent", value: porcentaje, max_uses: 1, min_subtotal_cents: 0, active: true, suma_combo: true,
      expires_at: new Date(Date.now() + horas * 3600_000).toISOString(),
    });
    if (!error) return code;
  }
  return null;
}
