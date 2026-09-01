import { google } from "googleapis";
import type { Row, Status, HealthCheck } from "./types";

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
    return new google.auth.GoogleAuth({ credentials: JSON.parse(inline), scopes });
  }
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

export async function fetchRows(): Promise<{ rows: Row[]; lastScrape: string | null; checks: HealthCheck[] }> {
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
  const iOrders = idx("order_ref");

  const today = nowCentral().slice(0, 10);
  const rows: Row[] = [];
  const brandComm: Record<string, number> = {};
  // Anomaly tallies for the data-integrity check.
  const seenTx = new Set<string>();
  let futureDated = 0;
  let badTimestamp = 0;
  let duplicateIds = 0;

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

    const date = datetime.slice(0, 10);
    if (date > today) futureDated++;
    if (!/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(datetime)) badTimestamp++;
    const tx = String(r[iTx] ?? "");
    if (tx) {
      if (seenTx.has(tx)) duplicateIds++;
      else seenTx.add(tx);
    }

    rows.push({
      transactionId: tx,
      advertiserId,
      advertiser: String(r[iAdv] ?? r[iAdvId] ?? "Unknown"),
      date,
      datetime,
      sale: toDollars(r[iSale]),
      commission,
      status: normalizeStatus(r[iStatus]),
      orders,
    });
  }

  const lastScrape = statusRes?.data.values?.[0]?.[0] ? String(statusRes.data.values[0][0]) : null;
  const rpmTrack = (rpmRes?.data.values ?? []).map((r) => r.map((c) => String(c ?? "")));
  const auditVals = (auditRes?.data.values ?? []).map((r) => r.map((c) => String(c ?? "")));
  const checks = computeChecks({ lastScrape, brandComm, rpmTrack, auditVals, futureDated, badTimestamp, duplicateIds });

  return { rows, lastScrape, checks };
}

/** The morning health check — the same things I verify by hand, on demand. */
function computeChecks({
  lastScrape,
  brandComm,
  rpmTrack,
  auditVals,
  futureDated,
  badTimestamp,
  duplicateIds,
}: {
  lastScrape: string | null;
  brandComm: Record<string, number>;
  rpmTrack: string[][];
  auditVals: string[][];
  futureDated: number;
  badTimestamp: number;
  duplicateIds: number;
}): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const DOLLAR_TOL = 50;
  const PCT_TOL = 0.05;

  // 1. Scraper freshness.
  if (lastScrape) {
    const now = nowCentral();
    const hoursSince = (Date.parse(now.replace(" ", "T")) - Date.parse(lastScrape.replace(" ", "T"))) / 3_600_000;
    const centralHour = Number(now.slice(11, 13));
    const stale = Number.isFinite(hoursSince) && hoursSince > 4 && centralHour >= 7 && centralHour < 23;
    checks.push({
      label: "Scraper is running",
      status: stale ? "error" : "ok",
      detail: stale
        ? `No update in ${hoursSince.toFixed(1)}h — the scraper may be down. Last update ${lastScrape}.`
        : `Last update ${lastScrape}${Number.isFinite(hoursSince) ? ` (${hoursSince.toFixed(1)}h ago)` : ""}.`,
    });
  } else {
    checks.push({ label: "Scraper is running", status: "warn", detail: "No heartbeat found." });
  }

  // 2. RPM vs platform.
  if (rpmTrack.length > 1) {
    const platform = parseFloat(rpmTrack[rpmTrack.length - 1][2]);
    const sheet = brandComm["rpm-pickleball"] || 0;
    if (Number.isFinite(platform) && platform > 0) {
      const diff = sheet - platform;
      const off = Math.abs(diff) > DOLLAR_TOL;
      checks.push({
        label: "RPM matches the platform",
        status: off ? "error" : "ok",
        detail: off
          ? `Off by ${usd(Math.abs(diff))} — sheet ${usd(sheet)} vs platform ${usd(platform)}.`
          : `Exact — ${usd(sheet)} = platform ${usd(platform)}.`,
      });
    }
  }

  // 3. Other brands with platform-truth (Audit Aggregates → SocialSnowball etc.).
  const offBrands: string[] = [];
  let brandsChecked = 0;
  for (let i = 1; i < auditVals.length; i++) {
    const advertiserId = String(auditVals[i][0] ?? "").toLowerCase();
    const platformTotal = parseFloat(auditVals[i][4]);
    if (!advertiserId || !Number.isFinite(platformTotal) || platformTotal <= 0) continue;
    brandsChecked++;
    const sheet = brandComm[advertiserId] || 0;
    const diff = sheet - platformTotal;
    if (Math.abs(diff) > DOLLAR_TOL && Math.abs(diff) / platformTotal > PCT_TOL) {
      offBrands.push(`${advertiserId} off by ${usd(Math.abs(diff))} (sheet ${usd(sheet)} vs ${usd(platformTotal)})`);
    }
  }
  if (brandsChecked > 0) {
    checks.push({
      label: "Brands match their platforms",
      status: offBrands.length ? "warn" : "ok",
      detail: offBrands.length ? offBrands.join("; ") : `All ${brandsChecked} verifiable brand(s) within tolerance.`,
    });
  }

  // 4. Data integrity.
  const problems: string[] = [];
  if (futureDated > 0) problems.push(`${futureDated} future-dated row(s)`);
  if (badTimestamp > 0) problems.push(`${badTimestamp} malformed timestamp(s)`);
  if (duplicateIds > 0) problems.push(`${duplicateIds} duplicate transaction id(s)`);
  checks.push({
    label: "No data anomalies",
    status: problems.length ? "error" : "ok",
    detail: problems.length ? problems.join("; ") : "No future dates, bad timestamps, or duplicate IDs.",
  });

  return checks;
}
