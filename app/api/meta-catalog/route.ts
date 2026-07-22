import { NextResponse } from "next/server";
import { buildMetaCatalogCsv } from "@/lib/meta-catalog";

export const dynamic = "force-dynamic"; // always live — Meta re-fetches on a schedule

// Meta Commerce scheduled feed. Point Commerce Manager at this URL; it reflects
// the current catalog (availability, new/removed products) on every fetch.
export async function GET() {
  const csv = await buildMetaCatalogCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="blade_catalog_meta.csv"',
      "Cache-Control": "public, max-age=300", // 5 min; Meta pulls hourly anyway
    },
  });
}
