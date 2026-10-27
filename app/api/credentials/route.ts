import { NextResponse } from "next/server";

// Never cache credentials, and always run server-side.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Returns the affiliate-portal login (email + password) for one brand.
 *
 * Two ways to supply credentials, checked in order — both keep secrets OUT of the
 * (public) repo, and this route sits behind the dashboard login gate (middleware.ts):
 *
 *   1. NOTION_TOKEN  — read live from the "Affiliate Partners" Notion DB (preferred:
 *      Notion stays the single source of truth; nothing to re-sync). Needs an internal
 *      Notion integration token shared with the page.
 *   2. BRAND_CREDENTIALS_JSON — a JSON blob { "<slug>": { email, password } } in a
 *      Vercel secret. Fallback if you'd rather not use Notion.
 *
 * Returns creds for a single requested brand at a time.
 */

const NOTION_DB_ID = "1c14b3848bfc802694acd78094eeb8c9";

// advertiser_id (sheet slug) → Brand title in the Notion DB.
const SLUG_TO_NOTION: Record<string, string> = {
  "11six24": "11six24", aireo: "Aireo", "bread-butter": "Bread & Butter", chorus: "Chorus",
  crbn: "CRBN", daps: "DAPS", diadem: "Diadem", dominator: "Dominator", engage: "Engage",
  enhance: "Enhance", erne: "ERNE", flik: "FLIK", franklin: "Franklin", friday: "Friday",
  gearbox: "Gearbox", gherkin: "Gherkin", "goaffpro-forwrd": "FORWRD", gruvn: "GRÜVN",
  head: "HEAD", holbrook: "Holbrook", honolulu: "Honolulu", joola: "JOOLA", luzz: "Luzz",
  mark: "Mark", neonic: "Neonic", paddletek: "Paddletek", pickleballapes: "Pickleball Apes",
  pickleballgetaways: "Pickleball Getaways", proton: "Proton", "rpm-pickleball": "RPM",
  selkirk: "Selkirk", sixzero: "Six Zero", slamit: "SLAMIT", slyce: "Slyce", speedup: "Speedup",
  thrive: "Thrive", udrippin: "UDrippin", vatic: "Vatic", volair: "Volair", "warping-point": "Warping Point",
};

const plain = (prop: { title?: { plain_text: string }[]; rich_text?: { plain_text: string }[] } | undefined) =>
  (prop?.title ?? prop?.rich_text ?? []).map((t) => t.plain_text).join("").trim() || null;

async function fromNotion(slug: string, token: string) {
  const brand = SLUG_TO_NOTION[slug];
  if (!brand) return { email: null, password: null };
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filter: { property: "Brand", title: { equals: brand } }, page_size: 1 }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`notion ${res.status}`);
  const data = await res.json();
  const props = data.results?.[0]?.properties ?? {};
  return { email: plain(props["Affiliate ID"]), password: plain(props["Password"]) };
}

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("brand")?.toLowerCase();
  if (!slug) {
    return NextResponse.json({ error: "missing brand" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const noStore = { "Cache-Control": "no-store" };

  // 1) Live from Notion.
  const token = process.env.NOTION_TOKEN;
  if (token) {
    try {
      return NextResponse.json(await fromNotion(slug, token), { headers: noStore });
    } catch {
      // fall through to the JSON secret if Notion is unreachable/misconfigured
    }
  }

  // 2) JSON secret fallback.
  try {
    const creds = JSON.parse(process.env.BRAND_CREDENTIALS_JSON || "{}");
    const entry = creds[slug];
    return NextResponse.json({ email: entry?.email ?? null, password: entry?.password ?? null }, { headers: noStore });
  } catch {
    return NextResponse.json({ email: null, password: null }, { headers: noStore });
  }
}
