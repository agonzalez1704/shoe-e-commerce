import "server-only";

// Client for the auto-toon (toon-converter) product-angles API: one product
// photo -> multiple generated angles. Two-phase (generate hero -> confirm ->
// poll), which we drive automatically for a one-click flow.
const BASE = process.env.TOON_API_URL?.replace(/\/$/, "");
const KEY = process.env.TOON_API_KEY;

// shoe-appropriate angles; "front" is the required hero. Kept to 3 so the
// synchronous server action stays under Vercel's 300s function limit
// (each image ~60-90s). More angles -> move to an async/polling flow.
export const DEFAULT_ANGLES = ["front", "three-quarter-left", "three-quarter-right"];

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 270_000;

type AngleSet = { id: string; status: string; angleUrls?: string[]; errorMessage?: string };

async function toon<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE || !KEY) throw new Error("auto-toon no configurado (TOON_API_URL / TOON_API_KEY)");
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "x-api-key": KEY, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`auto-toon ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// Poll until the set reaches one of `targets` (or fails / times out).
async function pollUntil(angleSetId: string, targets: string[]): Promise<AngleSet> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const { sets } = await toon<{ sets: AngleSet[] }>("/api/product-angles");
    const set = sets.find((s) => s.id === angleSetId);
    if (!set) continue;
    if (set.status === "failed") throw new Error(set.errorMessage ?? "auto-toon falló");
    if (targets.includes(set.status)) return set;
  }
  throw new Error("auto-toon agotó el tiempo de espera");
}

// Returns the generated angle image URLs (hosted on toon's storage).
export async function generateAngles(
  sourceImageUrl: string,
  productName: string,
  angles: string[] = DEFAULT_ANGLES,
): Promise<string[]> {
  const { angleSetId } = await toon<{ angleSetId: string }>("/api/product-angles/generate", {
    method: "POST",
    body: JSON.stringify({ sourceImageUrl, productName, selectedAngles: angles }),
  });

  // phase 1: wait for the hero, then auto-approve it
  await pollUntil(angleSetId, ["awaiting_confirmation", "ready"]);
  await toon("/api/product-angles/confirm", {
    method: "POST",
    body: JSON.stringify({ angleSetId, confirmed: true }),
  });

  // phase 2: wait for the remaining angles
  const final = await pollUntil(angleSetId, ["ready"]);
  return final.angleUrls ?? [];
}
