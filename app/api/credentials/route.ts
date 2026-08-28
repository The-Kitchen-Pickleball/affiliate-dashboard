import { NextResponse } from "next/server";

// Never cache credentials, and always run server-side.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Returns the affiliate-portal login (email + password) for one brand.
 *
 * Credentials live ONLY in the Vercel secret `BRAND_CREDENTIALS_JSON` — never in
 * the (public) repo. Shape: { "<slug>": { "email": "...", "password": "..." }, ... }.
 * This route sits behind the dashboard login gate (see middleware.ts), so only an
 * authenticated viewer can reach it, and it returns creds for a single requested
 * brand at a time rather than dumping the whole set.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("brand")?.toLowerCase();
  if (!slug) {
    return NextResponse.json({ error: "missing brand" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let creds: Record<string, { email?: string; password?: string }> = {};
  try {
    creds = JSON.parse(process.env.BRAND_CREDENTIALS_JSON || "{}");
  } catch {
    return NextResponse.json({ error: "credentials store not configured" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  const entry = creds[slug];
  return NextResponse.json(
    { email: entry?.email ?? null, password: entry?.password ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
