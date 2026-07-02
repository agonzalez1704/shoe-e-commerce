import "server-only";

// Client for the auto-toon (toon-converter) product-angles API. We kick off a
// job with a completion webhook + autoConfirm and return immediately — no
// waiting, no polling. auto-toon calls our webhook when the angles are ready.
const BASE = process.env.TOON_API_URL?.replace(/\/$/, "");
const KEY = process.env.TOON_API_KEY;

// shoe-appropriate angles. API enum: front | back | left | right | top | bottom.
// left+right (the two lateral profiles) + top (overhead) are the most visually
// distinct views for footwear. front is no longer forced; the hero anchor is the
// first selected angle (left). toon's /run renders one angle per invocation and
// self-chains, so no single call approaches the 300s function limit.
export const DEFAULT_ANGLES = ["left", "right", "top"];

export type AngleSet = { id: string; status: string; angleUrls?: string[]; errorMessage?: string };

async function toon<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE || !KEY) throw new Error("auto-toon no configurado (TOON_API_URL / TOON_API_KEY)");
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "x-api-key": KEY, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`auto-toon ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// auto-toon runs remotely and downloads the source itself, so a localhost /
// private URL (e.g. the local Supabase stack) is unreachable. Reject up front.
function assertPublicUrl(u: string): void {
  let parsed: URL;
  try { parsed = new URL(u); } catch { throw new Error("La URL de la imagen no es válida."); }
  const h = parsed.hostname;
  const isPrivate =
    parsed.protocol !== "https:" && parsed.protocol !== "http:"
      ? true
      : h === "localhost" || h === "0.0.0.0" || h === "::1" || h.endsWith(".local") ||
        /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  if (isPrivate) {
    throw new Error(
      `auto-toon necesita una imagen con URL pública, pero la tuya apunta a "${h}" (local/privada). ` +
        "Genera los ángulos en producción, donde el almacenamiento es público y accesible.",
    );
  }
}

export type StartOpts = { webhookUrl: string; webhookSecret: string; angles?: string[] };

// Fire-and-forget: returns the auto-toon set id. Completion arrives via webhook.
export async function startAngleGeneration(
  sourceImageUrl: string,
  productName: string,
  opts: StartOpts,
): Promise<string> {
  assertPublicUrl(sourceImageUrl);
  const { angleSetId } = await toon<{ angleSetId: string }>("/api/product-angles/generate", {
    method: "POST",
    body: JSON.stringify({
      sourceImageUrl,
      productName,
      selectedAngles: opts.angles ?? DEFAULT_ANGLES,
      webhookUrl: opts.webhookUrl,
      webhookSecret: opts.webhookSecret,
      autoConfirm: true,
    }),
  });
  return angleSetId;
}

// Fallback reconciliation if a webhook is ever missed (single fast request).
export async function getAngleSet(angleSetId: string): Promise<AngleSet | null> {
  const { sets } = await toon<{ sets: AngleSet[] }>("/api/product-angles");
  return sets.find((s) => s.id === angleSetId) ?? null;
}
