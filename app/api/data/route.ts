import { NextResponse } from "next/server";
import { fetchRows } from "@/lib/sheets";
import type { ApiResponse } from "@/lib/types";

// Cache the sheet read for 3 minutes so rapid dashboard interactions don't
// hammer the Sheets API. Data only changes when a scrape writes (~every 40 min).
export const revalidate = 180;

export async function GET() {
  try {
    const { rows, lastScrape } = await fetchRows();
    const body: ApiResponse = {
      rows,
      lastScrape,
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "s-maxage=180, stale-while-revalidate=600" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
