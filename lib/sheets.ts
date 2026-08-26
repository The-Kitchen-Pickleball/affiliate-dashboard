import { google } from "googleapis";
import type { Row, Status } from "./types";

/**
 * Reads the shared commissions Google Sheet server-side via the affiliate
 * service account. Supports two credential sources:
 *   - GOOGLE_CREDENTIALS_JSON  (inline JSON — used on Vercel)
 *   - GOOGLE_APPLICATION_CREDENTIALS  (a file path — used locally)
 * The scrapers own this sheet; the dashboard only ever READS it.
 */

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const COMMISSIONS_TAB = "Comissions"; // sic — real tab name has one M
const STATUS_TAB = "Status";

function getAuth() {
  const scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
  const inline = process.env.GOOGLE_CREDENTIALS_JSON;
  if (inline) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(inline),
      scopes,
    });
  }
  // Falls back to GOOGLE_APPLICATION_CREDENTIALS (a key-file path).
  return new google.auth.GoogleAuth({ scopes });
}

function normalizeStatus(s: string): Status {
  const v = (s || "").toLowerCase().trim();
  if (v === "approved" || v === "declined") return v;
  return "pending";
}

function toDollars(cents: string): number {
  const n = Number(cents);
  return Number.isFinite(n) ? n / 100 : 0;
}

export async function fetchRows(): Promise<{ rows: Row[]; lastScrape: string | null }> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() as never });

  const [commRes, statusRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${COMMISSIONS_TAB}!A:H` }),
    sheets.spreadsheets.values
      .get({ spreadsheetId: SHEET_ID, range: `${STATUS_TAB}!A2` })
      .catch(() => null),
  ]);

  const values = commRes.data.values ?? [];
  const header = (values[0] ?? []).map((h) => String(h).trim());
  const idx = (name: string) => header.indexOf(name);
  const iTx = idx("transaction_id");
  const iAdvId = idx("advertiser_id");
  const iAdv = idx("advertiser_name");
  const iDate = idx("order_date");
  const iSale = idx("sale_amount");
  const iComm = idx("commission_amount");
  const iStatus = idx("status");

  const rows: Row[] = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const datetime = String(r[iDate] ?? "");
    if (!datetime) continue;
    rows.push({
      transactionId: String(r[iTx] ?? ""),
      advertiserId: String(r[iAdvId] ?? "").toLowerCase(),
      advertiser: String(r[iAdv] ?? r[iAdvId] ?? "Unknown"),
      date: datetime.slice(0, 10),
      datetime,
      sale: toDollars(r[iSale]),
      commission: toDollars(r[iComm]),
      status: normalizeStatus(r[iStatus]),
    });
  }

  const lastScrape = statusRes?.data.values?.[0]?.[0] ?? null;
  return { rows, lastScrape: lastScrape ? String(lastScrape) : null };
}
