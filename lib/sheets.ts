import { google } from "googleapis";
import type { Row, Status, HealthCheck, PayoutRow } from "./types";

/**
 * Reads the shared commissions Google Sheet server-side via the affiliate
 * service account. The scrapers own this sheet; the dashboard only ever READS it.
 */

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const COMMISSIONS_TAB = "Comissions"; // sic — real tab name has one M
const STATUS_TAB = "Status";
const RPM_TRACK_TAB = "RPM Commissions"; // RPM platform cumulative lives here
// Brands whose order_ref column holds something other than an order number
// (RPM: a sales count per delta row; HEAD: a landing-page URL).
const ORDER_REF_NOT_AN_ORDER = new Set(["rpm-pickleball", "head"]);
const BRAND_STATUS_TAB = "Brand Status"; // per-brand last successful update (written by the scrapers' shared write paths)
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

export async function fetchRows(): Promise<{ rows: Row[]; lastScrape: string | null; checks: HealthCheck[]; payouts: PayoutRow[] }> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth: (await auth.getClient()) as never });

  const [commRes, statusRes, rpmRes, auditRes, brandStatusRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${COMMISSIONS_TAB}!A:V` }),
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${STATUS_TAB}!A2` }).catch(() => null),
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${RPM_TRACK_TAB}!A:E` }).catch(() => null),
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${AUDIT_TAB}!A:H` }).catch(() => null),
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${BRAND_STATUS_TAB}!A:B` }).catch(() => null),
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
  // Approved-only commission per brand. The platform aggregates (paid + approved-
  // outstanding) exclude pending, so the "matches platform" check compares against
  // THIS, not brandComm — otherwise a brand carrying pending commission (e.g.
  // UpPromote/Honolulu) looks "off" by exactly its pending balance (a false alarm).
  const brandApprovedComm: Record<string, number> = {};
  const brandOrders: Record<string, number> = {};
  const brandRecent: Record<string, number> = {}; // sales in the last 3 days
  const brandPriorDays: Record<string, Set<string>> = {}; // distinct active days, days 3–30 ago
  const seenTx = new Set<string>();
  let futureDated = 0;
  let badTimestamp = 0;
  let duplicateIds = 0;
  // Positive, non-declined sales per brand+order number (see the duplicate-order check).
  const orderSales = new Map<string, { date: string; commission: number }[]>();

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const datetime = String(r[iDate] ?? "");
    if (!datetime) continue;
    const advertiserId = String(r[iAdvId] ?? "").toLowerCase();
    const ocRaw = String(r[iOrders] ?? "").trim();
    const oc = parseInt(ocRaw, 10);
    const orders = advertiserId === "rpm-pickleball" && ocRaw !== "" && Number.isFinite(oc) ? oc : 1;
    const commission = toDollars(r[iComm]);
    const st = normalizeStatus(r[iStatus]);
    brandComm[advertiserId] = (brandComm[advertiserId] || 0) + commission;
    if (st === "approved") brandApprovedComm[advertiserId] = (brandApprovedComm[advertiserId] || 0) + commission;
    brandOrders[advertiserId] = (brandOrders[advertiserId] || 0) + orders;

    const date = datetime.slice(0, 10);
    if (date >= recentStart && date <= today) brandRecent[advertiserId] = (brandRecent[advertiserId] || 0) + 1;
    if (date >= priorStart && date <= priorEnd) (brandPriorDays[advertiserId] ??= new Set()).add(date);
    if (date > today) futureDated++;
    if (commission > 0 && st !== "declined" && ocRaw && !ORDER_REF_NOT_AN_ORDER.has(advertiserId)) {
      const key = `${advertiserId}|${ocRaw}`;
      if (!orderSales.has(key)) orderSales.set(key, []);
      orderSales.get(key)!.push({ date, commission });
    }
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
      status: st,
      orders,
    });
  }

  const heartbeat = statusRes?.data.values?.[0]?.[0] ? String(statusRes.data.values[0][0]) : null;
  const rpmTrack = (rpmRes?.data.values ?? []).map((r) => r.map((c) => String(c ?? "")));
  const auditVals = (auditRes?.data.values ?? []).map((r) => r.map((c) => String(c ?? "")));
  const brandStatusVals = (brandStatusRes?.data.values ?? []).map((r) => r.map((c) => String(c ?? "")));
  // "Updated …" = when data last landed, not when a run last finished end-to-end.
  // The Status heartbeat is only written when a whole run succeeds, so a run that
  // times out partway (e.g. a mass UpPromote re-login, 2026-10-08) left the header
  // saying "8:46am" while brands kept updating until 10:44. Use the newest of the
  // heartbeat and every brand's Brand Status stamp; per-brand failures are caught
  // by the "Every brand is updating" check, which compares against this.
  const lastScrape = [heartbeat, ...brandStatusVals.slice(1).map((r) => r[1])]
    .filter((t): t is string => !!t && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t))
    .sort()
    .pop() ?? null;

  // Payout tracker: one row per brand, covering EVERY brand we have data for.
  // A brand is "tracked" only when its platform reports a real PAID history
  // (paid > 0 in the Audit Aggregates tab) — that proves the platform exposes
  // payout status, so "still owed" (outstanding) is trustworthy. Brands at
  // paid=$0 either pay outside the platform (e.g. UpPromote → Honolulu) or are
  // genuinely unpaid, and we can't tell which, so we mark them "can't be tracked"
  // rather than show a misleading "owed". The dashboard's Payouts tab shows a
  // status line for all of them.
  const auditById = new Map(
    auditVals.slice(1).map((r) => [
      (r[0] ?? "").toLowerCase(),
      {
        paid: parseFloat(r[2]) || 0,
        outstanding: parseFloat(r[3]) || 0,
        total: parseFloat(r[4]) || 0,
        lastPayout: (r[7] ?? "").trim() || null, // col H: last_payout_date (best-effort)
      },
    ]),
  );
  // Universe of brands = every advertiser_id seen on the Comissions tab.
  const brandIds = [...new Set(rows.map((r) => r.advertiserId))].filter(Boolean);
  const payouts: PayoutRow[] = brandIds.map((id) => {
    const a = auditById.get(id);
    const paid = a?.paid ?? 0;
    const tracked = paid > 0;
    return {
      advertiserId: id,
      tracked,
      paid,
      outstanding: tracked ? a?.outstanding ?? 0 : 0,
      total: tracked ? a?.total ?? 0 : 0,
      lastPayout: tracked ? a?.lastPayout ?? null : null,
    };
  });

  const checks = computeChecks({
    lastScrape, brandComm, brandApprovedComm, brandOrders, brandRecent, brandPriorDays,
    rpmTrack, auditVals, brandStatusVals, futureDated, badTimestamp, duplicateIds, orderSales,
    since30: addDays(today, -30),
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

  return { rows, lastScrape, checks, payouts };
}

/** The morning health check — the same things I verify by hand, on demand. */
function computeChecks(o: {
  lastScrape: string | null;
  brandComm: Record<string, number>;
  brandApprovedComm: Record<string, number>;
  brandOrders: Record<string, number>;
  brandRecent: Record<string, number>;
  brandPriorDays: Record<string, Set<string>>;
  rpmTrack: string[][];
  auditVals: string[][];
  brandStatusVals: string[][];
  orderSales: Map<string, { date: string; commission: number }[]>;
  since30: string;
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

  // 2b. RPM freshness — its own alert. RPM now runs on Dane's Mac (home IP) via a
  // launchd job every ~90 min WHENEVER THE MAC IS ON (Shopify kills Collabs
  // sessions used from the cloud). So a normal overnight gap while the Mac sleeps
  // (8-12h+) is expected and self-heals on wake — it must NOT alarm. Only flag when
  // it's stale far longer than any normal sleep (>20h ≈ the Mac was off a full day,
  // or the session genuinely died). The "RPM Commissions" tab logs scraped_at on
  // every successful run. Threshold raised from 5h→20h + active-hours gate removed
  // when RPM moved to the Mac (2026-09-30).
  if (o.rpmTrack.length > 1) {
    const rpmScrapedAt = o.rpmTrack[o.rpmTrack.length - 1][0];
    if (rpmScrapedAt && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(rpmScrapedAt)) {
      const now = nowCentral();
      const rpmHours = (Date.parse(now.replace(" ", "T")) - Date.parse(rpmScrapedAt.replace(" ", "T"))) / 3_600_000;
      const rpmStale = Number.isFinite(rpmHours) && rpmHours > 20;
      checks.push({
        label: "RPM is updating",
        status: rpmStale ? "error" : "ok",
        detail: rpmStale
          ? `RPM hasn't updated in ${rpmHours.toFixed(1)}h (last ${rpmScrapedAt}) — it runs on Dane's Mac, so first make sure the Mac has been on; if it stays stale, its Collabs cookies may need a refresh.`
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
    // Compare approved-only against the platform total (paid + approved-outstanding).
    // Pending sheet commission isn't in the platform number, so including it would
    // flag a brand as "off" by its whole pending balance (false alarm — Honolulu).
    const sheet = o.brandApprovedComm[advertiserId] || 0;
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

  // 3b. Every brand is updating. "Scraper is running" only proves the overall run
  //     finished — a single brand can fail inside it (e.g. its login breaks) while
  //     the run still counts as a success. That's how Selkirk/Speedup/Slyce/Kitchen
  //     Blockers silently froze for a day in Oct 2026 (and Gruvn since July).
  //     Every successful brand write stamps last_success_at in the "Brand Status"
  //     tab (shared reconcileToSheets / appendDeltaRow); Audit Aggregates'
  //     captured_at (col G) is used too, so brands that stopped before Brand Status
  //     existed are still caught. A brand more than 3h behind the latest run's
  //     heartbeat has missed ~2 runs in a row. Comparing to the heartbeat (not the
  //     clock) keeps this quiet overnight and when GitHub delays a run.
  //     RPM is skipped — it runs on Dane's Mac and has its own 20h check above.
  //     Gruvn is skipped at Dane's request (2026-10-06): no sales ever, and its
  //     login has been broken since July — not worth an alert.
  //     A retired brand will keep showing here until its row is deleted from both tabs.
  if (o.lastScrape) {
    const lastRun = Date.parse(o.lastScrape.replace(" ", "T"));
    const NOT_MONITORED = new Set(["rpm-pickleball", "gruvn"]);
    const latest = new Map<string, string>();
    const note = (id: string, at: string) => {
      if (!id || NOT_MONITORED.has(id) || !Number.isFinite(Date.parse(at.replace(" ", "T")))) return;
      if (!latest.has(id) || at > latest.get(id)!) latest.set(id, at);
    };
    for (const r of o.brandStatusVals.slice(1)) note(String(r[0] ?? "").toLowerCase(), String(r[1] ?? ""));
    for (const r of o.auditVals.slice(1)) note(String(r[0] ?? "").toLowerCase(), String(r[6] ?? ""));
    const behind: string[] = [];
    for (const [id, at] of latest) {
      const hoursBehind = (lastRun - Date.parse(at.replace(" ", "T"))) / 3_600_000;
      if (Number.isFinite(hoursBehind) && hoursBehind > 3) {
        const age = hoursBehind >= 48 ? `${Math.round(hoursBehind / 24)} days` : `${Math.round(hoursBehind)}h`;
        behind.push(`${id} (last updated ${at.slice(0, 16)}, ${age} ago)`);
      }
    }
    checks.push({
      label: "Every brand is updating",
      status: behind.length ? "error" : "ok",
      detail: behind.length
        ? `${behind.length} brand${behind.length > 1 ? "s are" : " is"} failing to update — usually a login problem. Their numbers are frozen until fixed: ${behind.join("; ")}.`
        : `All ${latest.size} monitored brands updated in the latest scrape.`,
    });
  }

  // 3c. Same order counted twice. Each sale should appear once per order number;
  //     a refund is a separate NEGATIVE row, so it doesn't count here. On
  //     2026-10-07 Current (Dominator) re-listed 5 old orders under new ids and
  //     one new order twice — ~$2,250 of phantom commission on one day that every
  //     other check missed (its own count matched the platform's). Looks at the
  //     last 30 days so a settled historical oddity doesn't alarm forever.
  {
    const dups: string[] = [];
    const dupKeys: string[] = [];
    for (const [key, sales] of o.orderSales) {
      if (sales.length < 2 || !sales.some((x) => x.date >= o.since30)) continue;
      const [brand, order] = key.split("|");
      const extra = sales.reduce((s2, x) => s2 + x.commission, 0) - Math.max(...sales.map((x) => x.commission));
      dups.push(`${brand} order ${order} ×${sales.length} (${sales.map((x) => x.date.slice(5)).join(", ")}; up to ${usd(extra)} extra)`);
      dupKeys.push(key);
    }
    checks.push({
      label: "No order counted twice",
      status: dups.length ? "warn" : "ok",
      dismissId: dups.length ? `dups:${dupKeys.sort().join(",")}` : undefined,
      detail: dups.length
        ? `The same order shows up as more than one sale — the totals may be inflated: ${dups.join("; ")}.`
        : "Every order number appears once per brand (last 30 days).",
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
