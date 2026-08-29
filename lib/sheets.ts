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
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${COMMISSIONS_TAB}!A:V` }),
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
  // RPM stores its real bundled order count in order_ref (see rpm/src/sheets.js).
  const iOrders = idx("order_ref");

  const rows: Row[] = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const datetime = String(r[iDate] ?? "");
    if (!datetime) continue;
    const advertiserId = String(r[iAdvId] ?? "").toLowerCase();
    // Only RPM carries a bundled order count in order_ref; everything else is 1
    // order per row. A present value is used even if 0 (a commission adjustment
    // with no new orders); an empty cell falls back to 1.
    const ocRaw = String(r[iOrders] ?? "").trim();
    const oc = parseInt(ocRaw, 10);
    const orders = advertiserId === "rpm-pickleball" && ocRaw !== "" && Number.isFinite(oc) ? oc : 1;
    rows.push({
      transactionId: String(r[iTx] ?? ""),
      advertiserId,
      advertiser: String(r[iAdv] ?? r[iAdvId] ?? "Unknown"),
      date: datetime.slice(0, 10),
      datetime,
      sale: toDollars(r[iSale]),
      commission: toDollars(r[iComm]),
      status: normalizeStatus(r[iStatus]),
      orders,
    });
  }

  const lastScrape = statusRes?.data.values?.[0]?.[0] ?? null;
  return { rows, lastScrape: lastScrape ? String(lastScrape) : null };
}
