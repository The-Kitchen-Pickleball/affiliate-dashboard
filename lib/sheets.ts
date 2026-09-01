import { google } from "googleapis";
import type { Row, Status, HealthIssue } from "./types";

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
const RPM_TRACK_TAB = "RPM Commissions"; // RPM platform cumulative lives here
const AUDIT_TAB = "Audit Aggregates"; // per-brand platform totals (SocialSnowball etc.)

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

/** Current wall-clock time in Central as "YYYY-MM-DD HH:MM:SS". */
function nowCentral(): string {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  const hh = g("hour") === "24" ? "00" : g("hour");
  return `${g("year")}-${g("month")}-${g("day")} ${hh}:${g("minute")}:${g("second")}`;
}

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function fetchRows(): Promise<{ rows: Row[]; lastScrape: string | null; health: HealthIssue[] }> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth: (await auth.getClient()) as never });

  const [commRes, statusRes, rpmRes, auditRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${COMMISSIONS_TAB}!A:V` }),
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${STATUS_TAB}!A2` }).catch(() => null),
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${RPM_TRACK_TAB}!A:E` }).catch(() => null),
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${AUDIT_TAB}!A:G` }).catch(() => null),
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
  // Per-brand commission sums (dollars) for the health checks below.
  const brandComm: Record<string, number> = {};
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const datetime = String(r[iDate] ?? "");
    if (!datetime) continue;
    const advertiserId = String(r[iAdvId] ?? "").toLowerCase();
    const ocRaw = String(r[iOrders] ?? "").trim();
    const oc = parseInt(ocRaw, 10);
    const orders = advertiserId === "rpm-pickleball" && ocRaw !== "" && Number.isFinite(oc) ? oc : 1;
    const commission = toDollars(r[iComm]);
    brandComm[advertiserId] = (brandComm[advertiserId] || 0) + commission;
    rows.push({
      transactionId: String(r[iTx] ?? ""),
      advertiserId,
      advertiser: String(r[iAdv] ?? r[iAdvId] ?? "Unknown"),
      date: datetime.slice(0, 10),
      datetime,
      sale: toDollars(r[iSale]),
      commission,
      status: normalizeStatus(r[iStatus]),
      orders,
    });
  }

  const lastScrape = statusRes?.data.values?.[0]?.[0] ?? null;
  const rpmTrack = (rpmRes?.data.values ?? []).map((r) => r.map((c) => String(c ?? "")));
  const auditVals = (auditRes?.data.values ?? []).map((r) => r.map((c) => String(c ?? "")));
  const health = computeHealth({ lastScrape: lastScrape ? String(lastScrape) : null, brandComm, rpmTrack, auditVals });

  return { rows, lastScrape: lastScrape ? String(lastScrape) : null, health };
}

/** Live health checks surfaced on the dashboard (so we don't rely on Slack). */
function computeHealth({
  lastScrape,
  brandComm,
  rpmTrack,
  auditVals,
}: {
  lastScrape: string | null;
  brandComm: Record<string, number>;
  rpmTrack: string[][];
  auditVals: string[][];
}): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const DOLLAR_TOL = 50;
  const PCT_TOL = 0.05;

  // 1. Scraper freshness — only during active hours (7am–11pm Central), so the
  //    normal overnight gap between scrapes doesn't cry wolf.
  if (lastScrape) {
    const now = nowCentral();
    const hoursSince = (Date.parse(now.replace(" ", "T")) - Date.parse(lastScrape.replace(" ", "T"))) / 3_600_000;
    const centralHour = Number(now.slice(11, 13));
    if (Number.isFinite(hoursSince) && hoursSince > 4 && centralHour >= 7 && centralHour < 23) {
      issues.push({
        severity: "error",
        message: `Data hasn't updated in ${hoursSince.toFixed(1)} hours — the scraper may be down. Last update ${lastScrape}.`,
      });
    }
  }

  // 2. RPM vs platform. RPM's sheet total must equal the platform's cumulative
  //    (latest "RPM Commissions" row). This is the check that has caught every
  //    RPM incident.
  if (rpmTrack.length > 1) {
    const platform = parseFloat(rpmTrack[rpmTrack.length - 1][2]);
    const sheet = brandComm["rpm-pickleball"] || 0;
    if (Number.isFinite(platform) && platform > 0) {
      const diff = sheet - platform;
      if (Math.abs(diff) > DOLLAR_TOL) {
        issues.push({
          severity: "error",
          message: `RPM is ${diff > 0 ? "over" : "under"} the platform by ${usd(Math.abs(diff))} (sheet ${usd(sheet)} vs platform ${usd(platform)}).`,
        });
      }
    }
  }

  // 3. Any other brand with platform-truth in Audit Aggregates (SocialSnowball,
  //    and any platform we extend it to). Off by >$50 AND >5% → flag.
  for (let i = 1; i < auditVals.length; i++) {
    const advertiserId = String(auditVals[i][0] ?? "").toLowerCase();
    const platformLabel = String(auditVals[i][1] ?? "platform");
    const platformTotal = parseFloat(auditVals[i][4]);
    if (!advertiserId || !Number.isFinite(platformTotal) || platformTotal <= 0) continue;
    const sheet = brandComm[advertiserId] || 0;
    const diff = sheet - platformTotal;
    if (Math.abs(diff) > DOLLAR_TOL && Math.abs(diff) / platformTotal > PCT_TOL) {
      issues.push({
        severity: "warn",
        message: `${advertiserId} is ${diff > 0 ? "over" : "under"} ${platformLabel} by ${usd(Math.abs(diff))} (sheet ${usd(sheet)} vs platform ${usd(platformTotal)}).`,
      });
    }
  }

  return issues;
}
