// One-time: register the inbound-message webhook for the connected WhatsApp
// number in Kapso. Prints the signing secret -> set it as KAPSO_WEBHOOK_SECRET.
//
//   node --env-file=.env.local scripts/register-kapso-webhook.mjs [webhookUrl]
//
// Uses KAPSO_API_KEY + KAPSO_PHONE_NUMBER_ID from env. For PROD, run with the
// prod KAPSO_* values and pass the prod URL (default below).
const KEY = process.env.KAPSO_API_KEY;
const PHONE = process.env.KAPSO_PHONE_NUMBER_ID;
const BASE = (process.env.KAPSO_API_BASE_URL ?? "https://api.kapso.ai").replace(/\/$/, "");
const URL_ARG =
  process.argv[2] ??
  (process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/webhooks/kapso`
    : "https://calzadoblade.com/api/webhooks/kapso");

if (!KEY || !PHONE) {
  console.error("Falta KAPSO_API_KEY o KAPSO_PHONE_NUMBER_ID en el entorno.");
  process.exit(1);
}

const res = await fetch(`${BASE}/platform/v1/whatsapp/phone_numbers/${PHONE}/webhooks`, {
  method: "POST",
  headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    webhook: {
      url: URL_ARG,
      events: ["whatsapp.message.received"],
      kind: "kapso",
      payload_version: "v2",
      buffer_enabled: true,
      buffer_window_seconds: 5,
      active: true,
    },
  }),
});

if (!res.ok) {
  console.error(`Kapso ${res.status}:`, await res.text());
  process.exit(1);
}

const { data } = await res.json();
const secret = data?.secret_key ?? data?.secret ?? "";
console.log("✓ Webhook registrado");
console.log("  URL:    ", URL_ARG);
console.log("  id:     ", data?.id);
console.log("  secret: ", secret);
console.log("\nGuarda esto como KAPSO_WEBHOOK_SECRET (en Vercel y .env).");
