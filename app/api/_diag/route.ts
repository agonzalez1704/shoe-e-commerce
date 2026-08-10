import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY. Reports which KIND of key each Supabase env var holds and whether
// it actually works, so a misconfigured deployment can be identified without
// anyone pasting a secret into a chat. It never returns a key value — only a
// classification, a length, and the result of one live call. Delete once the
// deployment is fixed.
//
// Guarded by a token because, while it exposes no secret, the shape of another
// store's infrastructure is nobody else's business.
const TOKEN = "diag-8f2c1a";

function classify(v: string | undefined) {
  if (!v) return "AUSENTE";
  const t = v.trim();
  if (t !== v) return `TIENE ESPACIOS (len ${v.length})`;
  if (/^["'].*["']$/.test(t)) return `ENTRE COMILLAS (len ${t.length})`;
  if (t.startsWith("eyJ")) return `JWT legado (len ${t.length})`;
  if (t.startsWith("sb_publishable_")) return `publishable (len ${t.length})`;
  if (t.startsWith("sb_secret_")) return `SECRET ← no va aquí (len ${t.length})`;
  return `desconocido "${t.slice(0, 6)}…" (len ${t.length})`;
}

async function probe(url: string | undefined, key: string | undefined, table: string) {
  if (!url || !key) return "no probado";
  try {
    const c = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await c.from(table).select("*", { head: true, count: "exact" }).limit(1);
    return error ? `FALLA: ${error.message}` : "OK";
  } catch (e) {
    return `EXCEPCIÓN: ${(e as Error).message}`;
  }
}

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("t") !== TOKEN) {
    return new NextResponse("not found", { status: 404 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json({
    marca: process.env.NEXT_PUBLIC_BRAND ?? "(sin definir)",
    proyecto_supabase: url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? "(URL rara o ausente)",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: classify(anon),
    SUPABASE_SERVICE_ROLE_KEY: classify(svc),
    prueba_anon: await probe(url, anon, "products"),
    prueba_service_role: await probe(url, svc, "carts"),
  });
}
