import { google } from "googleapis";
import type { Row, Status, HealthCheck } from "./types";
import { BRAND_PROFILES } from "./brandProfiles";

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
      const offOrders = Number.isFinite(platformOrders) && Math.abs(dOrders) > 15;
      checks.push({
        label: "RPM matches the platform",
        status: offUsd ? "error" : offOrders ? "warn" : "ok",
        detail: offUsd
          ? `Off by ${usd(Math.abs(dUsd))} — sheet ${usd(sheetUsd)} vs platform ${usd(platformUsd)}.`
          : offOrders
            ? `Dollars match (${usd(sheetUsd)}), but order count is off by ${dOrders} (sheet ${sheetOrders} vs platform ${platformOrders}).`
            : `${usd(sheetUsd)} — matches the platform exactly. (Order count ~${sheetOrders.toLocaleString()} vs ${platformOrders.toLocaleString()}; RPM's per-order counts are estimated, so a few off is normal.)`,
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

  // 4. Went-quiet watch — a brand that was regularly active (≥12 active days in the
  //    prior month) but has had zero sales in the last 3 days. Catches a silently
  //    broken scraper for the self-mirroring brands nothing else can verify.
  const quiet: string[] = [];
  for (const [adv, days] of Object.entries(o.brandPriorDays)) {
    if (days.size >= 12 && (o.brandRecent[adv] || 0) === 0) quiet.push(adv);
  }
  checks.push({
    label: "Active brands still reporting",
    status: quiet.length ? "warn" : "ok",
    dismissId: quiet.length ? `quiet:${[...quiet].sort().join(",")}` : undefined,
    detail: quiet.length
      ? `No sales in 5+ days from usually-active brand(s): ${quiet.join(", ")}. Could be a slow stretch — I'll keep watching it.`
      : "Every regularly-active brand has recent sales.",
  });

  // 5. Integrations that need manual attention (from the Notion connection status).
  const manual = Object.entries(BRAND_PROFILES)
    .filter(([, p]) => p.connected === "Disconnected" || p.connected === "Manual Process")
    .map(([id]) => id);
  checks.push({
    label: "Integrations connected",
    status: manual.length ? "warn" : "ok",
    dismissId: manual.length ? `integrations:${[...manual].sort().join(",")}` : undefined,
    detail: manual.length ? `Needs manual attention: ${manual.join(", ")}.` : "All integrations connected.",
  });

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
