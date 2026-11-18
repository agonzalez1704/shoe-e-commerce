import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCreditoPorVencerEmail } from "@/lib/email";
import { CREDITO } from "@/lib/credito";

// Un aviso por crédito, ~5 días antes de vencer, si sigue sin usarse
// (docs/CREDITO-BLADE.md). Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const ahora = Date.now();
  const { data: codigos, error } = await admin
    .from("discount_codes")
    .select("code, value, expires_at")
    .like("code", "CREDITO-%")
    .eq("active", true)
    .eq("used_count", 0)
    .gt("expires_at", new Date(ahora).toISOString())
    .lt("expires_at", new Date(ahora + CREDITO.avisoDias * 86400_000).toISOString())
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!codigos?.length) return NextResponse.json({ sent: 0 });

  const { data: orders } = await admin
    .from("orders")
    .select("id, email, credito_codigo")
    .in("credito_codigo", codigos.map((c) => c.code))
    .is("credito_recordado_at", null);

  let sent = 0;
  for (const o of orders ?? []) {
    const c = codigos.find((x) => x.code === o.credito_codigo)!;
    // Se marca antes de mandar: un reintento del cron no debe avisar dos veces.
    const { data: gano } = await admin
      .from("orders")
      .update({ credito_recordado_at: new Date().toISOString() })
      .eq("id", o.id)
      .is("credito_recordado_at", null)
      .select("id")
      .maybeSingle();
    if (!gano) continue;
    await sendCreditoPorVencerEmail({
      to: o.email,
      codigo: c.code,
      montoCents: c.value,
      venceIso: c.expires_at!,
      dias: Math.max(1, Math.ceil((new Date(c.expires_at!).getTime() - ahora) / 86400_000)),
    });
    sent++;
  }
  return NextResponse.json({ sent });
}
