import { NextResponse } from "next/server";
import { fetchRows } from "@/lib/sheets";
import type { ApiResponse } from "@/lib/types";

// Always read the live sheet — never serve a cached snapshot. This keeps the
// dashboard in lockstep with the latest scrape (like Looker) instead of lagging.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { rows, lastScrape, health } = await fetchRows();
    const body: ApiResponse = {
      rows,
      lastScrape,
      health,
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
