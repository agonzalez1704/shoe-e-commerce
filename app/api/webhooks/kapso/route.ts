import { createHmac, timingSafeEqual } from "node:crypto";
import { responderMensaje } from "@/lib/agent/sales-agent";
import { cargarHistorial, guardarMensaje } from "@/lib/agent/memoria";
import { estadoConversacion, marcarAsesor, getAsesores } from "@/lib/agent/handoff";
import { enviarTexto } from "@/lib/kapso";

export const runtime = "nodejs";
export const maxDuration = 60;

function firmaValida(secret: string, raw: string, firma: string | null): boolean {
  if (!secret || !firma) return false;
  const esperado = createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(esperado), Buffer.from(firma));
  } catch {
    return false;
  }
}

// Kapso verification handshake
export async function GET(req: Request) {
  const u = new URL(req.url);
  const challenge = u.searchParams.get("hub.challenge") ?? u.searchParams.get("challenge");
  return new Response(challenge ?? "ok", { status: 200 });
}

type Msg = { from?: string; type?: string; text?: { body?: string }; kapso?: { transcript?: { text?: string }; content?: string } };

function extraerTexto(m: Msg): string | null {
  return m.text?.body ?? m.kapso?.transcript?.text ?? m.kapso?.content ?? null;
}

export async function POST(req: Request) {
  const secret = process.env.KAPSO_WEBHOOK_SECRET ?? "";
  const raw = await req.text();

  if (req.headers.get("x-webhook-event") !== "whatsapp.message.received") {
    return new Response(null, { status: 200 }); // ignore other events
  }
  if (!firmaValida(secret, raw, req.headers.get("x-webhook-signature"))) {
    return new Response(JSON.stringify({ error: "bad signature" }), { status: 401 });
  }

  let payload: { phone_number_id?: string; message?: Msg; batch?: boolean; data?: { message?: Msg }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  const phoneNumberId = payload.phone_number_id ?? process.env.KAPSO_PHONE_NUMBER_ID ?? "";
  const mensajes: Msg[] = payload.batch && Array.isArray(payload.data)
    ? payload.data.map((d) => d.message).filter((m): m is Msg => !!m)
    : payload.message
      ? [payload.message]
      : [];

  for (const m of mensajes) {
    const numero = m.from;
    const texto = extraerTexto(m);
    if (!numero || !texto) continue;

    try {
      // human already handling this customer -> log, don't auto-reply
      if ((await estadoConversacion(numero)) === "asesor") {
        await guardarMensaje(numero, "user", texto);
        continue;
      }

      const historial = await cargarHistorial(numero, 10);
      const { texto: respuesta, escalar } = await responderMensaje([...historial, { role: "user", content: texto }]);
      await guardarMensaje(numero, "user", texto);
      await guardarMensaje(numero, "assistant", respuesta);
      await enviarTexto(phoneNumberId, numero, respuesta);

      if (escalar) {
        await marcarAsesor(numero, escalar.motivo);
        const asesores = getAsesores();
        const aviso =
          `🔔 *Un cliente necesita asesor*\n` +
          `Cliente: ${numero}\n` +
          `Motivo: ${escalar.motivo}\n` +
          `Último mensaje: "${texto}"\n\n` +
          `Respóndele directo; el bot quedó en pausa con ese cliente.`;
        await Promise.all(asesores.map((a) => enviarTexto(phoneNumberId, a, aviso).catch(() => {})));
      }
    } catch (err) {
      console.error("[kapso] webhook error:", err);
    }
  }

  return new Response(null, { status: 200 });
}
