import "server-only";

// Kapso REST client (WhatsApp via Meta proxy). Outbound replies + one-time
// webhook registration. Docs: https://api.kapso.ai
const META = process.env.KAPSO_META_VERSION ?? "v21.0";
const base = () => (process.env.KAPSO_API_BASE_URL ?? "https://api.kapso.ai").replace(/\/$/, "");

async function kapso<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.KAPSO_API_KEY;
  if (!key) throw new Error("KAPSO_API_KEY no configurado");
  const res = await fetch(base() + path, {
    ...init,
    headers: { "X-API-Key": key, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`kapso ${res.status}: ${await res.text()}`);
  return (res.status === 204 ? (undefined as T) : ((await res.json()) as T));
}

// Send a WhatsApp text reply.
export async function enviarTexto(phoneNumberId: string, to: string, body: string): Promise<void> {
  await kapso(`/meta/whatsapp/${META}/${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
}

// One-time onboarding: register the inbound-message webhook for a connected
// number. Returns the signing secret to store as KAPSO_WEBHOOK_SECRET.
// buffer_enabled batches rapid messages (payload.batch + data[]) — our webhook handles it.
export async function crearWebhookMensajes(
  phoneNumberId: string,
  webhookUrl: string,
): Promise<{ id: string; secret: string }> {
  const r = await kapso<{ data: { id: string; secret_key?: string; secret?: string } }>(
    `/platform/v1/whatsapp/phone_numbers/${phoneNumberId}/webhooks`,
    {
      method: "POST",
      body: JSON.stringify({
        webhook: {
          url: webhookUrl,
          events: ["whatsapp.message.received"],
          kind: "kapso",
          payload_version: "v2",
          buffer_enabled: true,
          buffer_window_seconds: 5,
          active: true,
        },
      }),
    },
  );
  return { id: r.data.id, secret: r.data.secret_key ?? r.data.secret ?? "" };
}
