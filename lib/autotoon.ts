import "server-only";

// Client for the auto-toon (toon-converter) product-angles API: one product
// photo -> multiple generated angles. Generation is SLOW (each image ~60-90s),
// so we expose granular calls (start / poll / confirm) and let the browser do
// the waiting — a single synchronous server action would blow Vercel's 300s
// function limit (it did: FUNCTION_INVOCATION_TIMEOUT at 5m).
const BASE = process.env.TOON_API_URL?.replace(/\/$/, "");
const KEY = process.env.TOON_API_KEY;

// shoe-appropriate angles; "front" is the required hero.
// API enum: front | back | left | right | top | bottom.
export const DEFAULT_ANGLES = ["front", "left", "right"];

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
// private URL (e.g. the local Supabase stack) is unreachable and the job fails
// with a vague error. Reject up front with an actionable message.
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

// Phase 0: kick off generation. Returns the set id immediately (fast).
export async function startAngleGeneration(
  sourceImageUrl: string,
  productName: string,
  angles: string[] = DEFAULT_ANGLES,
): Promise<string> {
  assertPublicUrl(sourceImageUrl);
  const { angleSetId } = await toon<{ angleSetId: string }>("/api/product-angles/generate", {
    method: "POST",
    body: JSON.stringify({ sourceImageUrl, productName, selectedAngles: angles }),
  });
  return angleSetId;
}

// Fetch current state of one set (fast, single request).
export async function getAngleSet(angleSetId: string): Promise<AngleSet> {
  const { sets } = await toon<{ sets: AngleSet[] }>("/api/product-angles");
  const set = sets.find((s) => s.id === angleSetId);
  if (!set) throw new Error("auto-toon: conjunto de ángulos no encontrado");
  return set;
}

// Approve the hero so the remaining angles start rendering (fast).
export async function confirmAngleSet(angleSetId: string): Promise<void> {
  await toon("/api/product-angles/confirm", {
    method: "POST",
    body: JSON.stringify({ angleSetId, confirmed: true }),
  });
}
