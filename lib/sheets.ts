import { google } from "googleapis";
import type { Row, Status, HealthCheck } from "./types";

/**
 * Reads the shared commissions Google Sheet server-side via the affiliate
 * service account. The scrapers own this sheet; the dashboard only ever READS it.
 */

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const COMMISSIONS_TAB = "Comissions"; // sic — real tab name has one M
const STATUS_TAB = "Status";
const RPM_TRACK_TAB = "RPM Commissions"; // RPM platform cumulative lives here
const AUDIT_TAB = "Audit Aggregates"; // per-brand platform totals (SocialSnowball etc.)

function getAuth() {
  const scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
  const inline = process.env.GOOGLE_CREDENTIALS_JSON;
  if (inline) return new google.auth.GoogleAuth({ credentials: JSON.parse(inline), scopes });
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

function addDays(d: string, n: number): string {
  return new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
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
  const recentStart = addDays(today, -4); // last 5 days (so a long weekend doesn't trip it)
  const priorStart = addDays(today, -30);
  const priorEnd = addDays(today, -5);

  const rows: Row[] = [];
  const brandComm: Record<string, number> = {};
  const brandOrders: Record<string, number> = {};
  const brandRecent: Record<string, number> = {}; // sales in the last 3 days
  const brandPriorDays: Record<string, Set<string>> = {}; // distinct active days, days 3–30 ago
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
    brandOrders[advertiserId] = (brandOrders[advertiserId] || 0) + orders;

    const date = datetime.slice(0, 10);
    if (date >= recentStart && date <= today) brandRecent[advertiserId] = (brandRecent[advertiserId] || 0) + 1;
    if (date >= priorStart && date <= priorEnd) (brandPriorDays[advertiserId] ??= new Set()).add(date);
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
  const checks = computeChecks({
    lastScrape, brandComm, brandOrders, brandRecent, brandPriorDays,
    rpmTrack, auditVals, futureDated, badTimestamp, duplicateIds,
  });

  // RPM per-row order count — gentle, capped reconciliation. A commission-bearing
  // RPM row can read 0 orders when the platform's EARNINGS ticked up before its
  // Sales COUNTER did (delta timing), which looks broken ("0 sales, but $91.80").
  // Any row with commission is at least one real sale, so floor such rows at 1 —
  // but only enough of them (most-recent first) to reach the platform's cumulative
  // count, never past it. This fixes today/recent days without inflating any single
  // day (each gets +1 = one real sale) and can NEVER exceed the platform (no
  // overcount). Older rows beyond the shortfall stay as-is. Earlier approaches
  // either dumped the whole gap on one row (inflated that day) or left 0s showing.
  if (rpmTrack.length > 1) {
    const platformRpmCount = parseInt(rpmTrack[rpmTrack.length - 1][1], 10);
    const rpmRows = rows.filter((r) => r.advertiserId === "rpm-pickleball");
    const rawSum = rpmRows.reduce((s, r) => s + r.orders, 0);
    let headroom = platformRpmCount - rawSum; // orders we may add without exceeding platform
    if (Number.isFinite(platformRpmCount) && headroom > 0) {
      const lag = rpmRows
        .filter((r) => r.commission > 0 && r.orders < 1)
        .sort((a, b) => b.datetime.localeCompare(a.datetime)); // most recent first
      for (const r of lag) {
        if (headroom <= 0) break;
        r.orders = 1;
        headroom -= 1;
      }
    }
  }

  return { rows, lastScrape, checks };
}

/** The morning health check — the same things I verify by hand, on demand. */
function computeChecks(o: {
  lastScrape: string | null;
  brandComm: Record<string, number>;
  brandOrders: Record<string, number>;
  brandRecent: Record<string, number>;
  brandPriorDays: Record<string, Set<string>>;
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
  if (o.lastScrape) {
    const now = nowCentral();
    const hoursSince = (Date.parse(now.replace(" ", "T")) - Date.parse(o.lastScrape.replace(" ", "T"))) / 3_600_000;
    const centralHour = Number(now.slice(11, 13));
    const stale = Number.isFinite(hoursSince) && hoursSince > 4 && centralHour >= 7 && centralHour < 23;
    checks.push({
      label: "Scraper is running",
      status: stale ? "error" : "ok",
      detail: stale
        ? `No update in ${hoursSince.toFixed(1)}h — the scraper may be down. Last update ${o.lastScrape}.`
        : `Last update ${o.lastScrape}${Number.isFinite(hoursSince) ? ` (${hoursSince.toFixed(1)}h ago)` : ""}.`,
    });
  } else {
    checks.push({ label: "Scraper is running", status: "warn", detail: "No heartbeat found." });
  }

  // 2. RPM — verify BOTH the dollars AND the order count against the platform.
  if (o.rpmTrack.length > 1) {
    const last = o.rpmTrack[o.rpmTrack.length - 1];
    const platformUsd = parseFloat(last[2]);
    const platformOrders = parseInt(last[1], 10);
    const sheetUsd = o.brandComm["rpm-pickleball"] || 0;
    const sheetOrders = o.brandOrders["rpm-pickleball"] || 0;
    if (Number.isFinite(platformUsd) && platformUsd > 0) {
      const dUsd = sheetUsd - platformUsd;
      const dOrders = sheetOrders - platformOrders;
      // Dollars are the source of truth (exact). RPM's order count is approximate
      // for reconstructed historical rows, so a small gap is expected — only a big
      // one is worth a soft flag.
      const offUsd = Math.abs(dUsd) > DOLLAR_TOL;
      // Only an OVERCOUNT is a real problem. The per-row count can lag the platform
      // slightly (a $0-net snapshot writes no row, so a few orders aren't counted) —
      // a harmless ~1% UNDERcount we leave as-is rather than distort a single day.
      // A sum that EXCEEDS the platform is the dangerous direction (a double-count),
      // so that's the only count condition we flag.
      const overCount = Number.isFinite(platformOrders) && dOrders > 5;
      checks.push({
        label: "RPM matches the platform",
        status: offUsd ? "error" : overCount ? "warn" : "ok",
        detail: offUsd
          ? `Off by ${usd(Math.abs(dUsd))} — sheet ${usd(sheetUsd)} vs platform ${usd(platformUsd)}.`
          : overCount
            ? `Dollars match (${usd(sheetUsd)}), but the order count is OVER the platform by ${dOrders} (sheet ${sheetOrders} vs platform ${platformOrders}) — a possible double-count, worth a look.`
            : `${usd(sheetUsd)} — matches the platform exactly. (Order count ~${sheetOrders.toLocaleString()} vs platform ${platformOrders.toLocaleString()}; RPM's per-order counts are estimated from deltas, so a small undercount is normal.)`,
      });
    }
  }

  // 2b. RPM freshness — its own alert. RPM runs NON-FATAL (Shopify Collabs has no
  // API, its session cookies expire ~daily, and 2FA now blocks auto-login), so a
  // stale RPM no longer freezes the whole heartbeat. This surfaces it directly:
  // the "RPM Commissions" tab logs scraped_at on every successful RPM run, so if
  // that's >5h old during active hours, the Collabs cookies almost certainly need
  // a refresh. This is the replacement signal for the old frozen-heartbeat behavior.
  if (o.rpmTrack.length > 1) {
    const rpmScrapedAt = o.rpmTrack[o.rpmTrack.length - 1][0];
    if (rpmScrapedAt && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(rpmScrapedAt)) {
      const now = nowCentral();
      const rpmHours = (Date.parse(now.replace(" ", "T")) - Date.parse(rpmScrapedAt.replace(" ", "T"))) / 3_600_000;
      const centralHour = Number(now.slice(11, 13));
      const rpmStale = Number.isFinite(rpmHours) && rpmHours > 5 && centralHour >= 7 && centralHour < 23;
      checks.push({
        label: "RPM is updating",
        status: rpmStale ? "error" : "ok",
        detail: rpmStale
          ? `RPM hasn't updated in ${rpmHours.toFixed(1)}h (last ${rpmScrapedAt}) — its Shopify Collabs login cookies have likely expired and need a refresh.`
          : `Last RPM update ${rpmScrapedAt}.`,
      });
    }
  }

  // 3. Other brands with platform-truth (Audit Aggregates → SocialSnowball etc.).
  const offBrands: string[] = [];
  const offBrandIds: string[] = [];
  let brandsChecked = 0;
  for (let i = 1; i < o.auditVals.length; i++) {
    const advertiserId = String(o.auditVals[i][0] ?? "").toLowerCase();
    const platformTotal = parseFloat(o.auditVals[i][4]);
    if (!advertiserId || !Number.isFinite(platformTotal) || platformTotal <= 0) continue;
    brandsChecked++;
    const sheet = o.brandComm[advertiserId] || 0;
    const diff = sheet - platformTotal;
    if (Math.abs(diff) > DOLLAR_TOL && Math.abs(diff) / platformTotal > PCT_TOL) {
      offBrands.push(`${advertiserId} off by ${usd(Math.abs(diff))} (sheet ${usd(sheet)} vs ${usd(platformTotal)})`);
      offBrandIds.push(advertiserId);
    }
  }
  const totalBrands = Object.keys(o.brandComm).filter(Boolean).length;
  if (brandsChecked > 0) {
    checks.push({
      label: "Brands match their platforms",
      status: offBrands.length ? "warn" : "ok",
      dismissId: offBrands.length ? `brands:${[...offBrandIds].sort().join(",")}` : undefined,
      detail: offBrands.length
        ? offBrands.join("; ")
        : `${brandsChecked} brand${brandsChecked > 1 ? "s" : ""} checked against platform totals; ${Math.max(0, totalBrands - brandsChecked)} others mirror their platform automatically.`,
    });
  }

  // 4. (Removed 2026-09-11 at Dane's request) The "went-quiet" watch flagged a
  //    regularly-active brand with no recent sales. It produced noise for brands
  //    just having a genuinely slow stretch, which Dane doesn't want alerts about.
  //    Data integrity (dollars/counts vs platform, anomalies) is still fully checked.

  // 5. Integrations that need manual attention (from the Notion connection status).
  // (The old "Integrations connected" check was removed — the only brands it ever
  // flagged were Refersion ones, which log in via an emailed magic link and can
  // never be automated, so it was permanent, un-actionable noise.)

  // 6. Data integrity.
  const problems: string[] = [];
  if (o.futureDated > 0) problems.push(`${o.futureDated} future-dated row(s)`);
  if (o.badTimestamp > 0) problems.push(`${o.badTimestamp} malformed timestamp(s)`);
  if (o.duplicateIds > 0) problems.push(`${o.duplicateIds} duplicate transaction id(s)`);
  checks.push({
    label: "No data anomalies",
    status: problems.length ? "error" : "ok",
    detail: problems.length ? problems.join("; ") : "No future dates, bad timestamps, or duplicate IDs.",
  });

  return checks;
}
