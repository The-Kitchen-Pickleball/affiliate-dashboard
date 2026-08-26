import type { Row, Status } from "./types";

export type RangePreset = "today" | "7d" | "30d" | "90d" | "wtd" | "mtd" | "ytd" | "all";

export interface Filters {
  preset: RangePreset;
  advertisers: string[]; // advertiserId list; empty = all
  statuses: Status[]; // empty = all
}

/** Central-time "today" as YYYY-MM-DD, computed on the client's clock but
 *  pinned to America/Chicago so it matches how the sheet stores dates. */
export function todayCentral(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Inclusive [start, end] ISO dates for a preset, relative to Central today. */
export function rangeFor(preset: RangePreset): { start: string; end: string } {
  const end = todayCentral();
  switch (preset) {
    case "today":
      return { start: end, end };
    case "7d":
      return { start: addDays(end, -6), end };
    case "30d":
      return { start: addDays(end, -29), end };
    case "90d":
      return { start: addDays(end, -89), end };
    case "wtd": {
      const [y, m, d] = end.split("-").map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
      return { start: addDays(end, -dow), end };
    }
    case "mtd":
      return { start: `${end.slice(0, 7)}-01`, end };
    case "ytd":
      return { start: `${end.slice(0, 4)}-01-01`, end };
    case "all":
      return { start: "2000-01-01", end };
  }
}

/** Inclusive [start, end] for the last N days ending on Central today. Used by the
 *  trend chart's own range control, independent of the page's date-range filter. */
export function lastNDaysRange(n: number): { start: string; end: string } {
  const end = todayCentral();
  return { start: addDays(end, -(n - 1)), end };
}

/** The immediately-preceding window of equal length, for comparison %. */
export function previousRange(preset: RangePreset): { start: string; end: string } | null {
  if (preset === "all") return null;
  const { start, end } = rangeFor(preset);
  const lenDays =
    (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
  return { start: addDays(start, -lenDays), end: addDays(end, -lenDays) };
}

/** The equal-length window immediately before [start, end], for comparison %. */
export function previousRangeCustom(start: string, end: string): { start: string; end: string } {
  const lenDays = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
  return { start: addDays(start, -lenDays), end: addDays(end, -lenDays) };
}

function inRange(row: Row, start: string, end: string): boolean {
  return row.date >= start && row.date <= end;
}

export function applyNonDateFilters(rows: Row[], f: Filters): Row[] {
  const advSet = new Set(f.advertisers);
  const statSet = new Set(f.statuses);
  return rows.filter(
    (r) =>
      (advSet.size === 0 || advSet.has(r.advertiserId)) &&
      (statSet.size === 0 || statSet.has(r.status)),
  );
}

export interface Totals {
  sales: number;
  commission: number;
  count: number;
}

export function totals(rows: Row[]): Totals {
  let sales = 0,
    commission = 0;
  for (const r of rows) {
    sales += r.sale;
    commission += r.commission;
  }
  return { sales, commission, count: rows.length };
}

export interface BrandAgg extends Totals {
  advertiserId: string;
  advertiser: string;
}

export function byBrand(rows: Row[]): BrandAgg[] {
  const map = new Map<string, BrandAgg>();
  for (const r of rows) {
    let a = map.get(r.advertiserId);
    if (!a) {
      a = { advertiserId: r.advertiserId, advertiser: r.advertiser, sales: 0, commission: 0, count: 0 };
      map.set(r.advertiserId, a);
    }
    a.sales += r.sale;
    a.commission += r.commission;
    a.count += 1;
  }
  return [...map.values()].sort((x, y) => y.commission - x.commission);
}

export interface BrandDetail {
  advertiserId: string;
  advertiser: string;
  // Main row totals = approved + pending only (declined excluded), matching KPIs.
  count: number;
  sales: number;
  commission: number;
  // Commission split by status (for the expandable detail).
  approvedComm: number;
  pendingComm: number;
  declinedComm: number;
  // Individual transactions for this brand (all statuses), newest first.
  items: Row[];
}

/** Per-brand aggregation from the full window (all statuses). Main totals exclude
 *  declined; the per-status commission split + individual sales are kept for the
 *  expandable rows. */
export function byBrandDetailed(rows: Row[]): BrandDetail[] {
  const map = new Map<string, BrandDetail>();
  for (const r of rows) {
    let b = map.get(r.advertiserId);
    if (!b) {
      b = {
        advertiserId: r.advertiserId,
        advertiser: r.advertiser,
        count: 0,
        sales: 0,
        commission: 0,
        approvedComm: 0,
        pendingComm: 0,
        declinedComm: 0,
        items: [],
      };
      map.set(r.advertiserId, b);
    }
    b.items.push(r);
    if (r.status === "declined") {
      b.declinedComm += r.commission;
    } else {
      b.count += 1;
      b.sales += r.sale;
      b.commission += r.commission;
      if (r.status === "approved") b.approvedComm += r.commission;
      else b.pendingComm += r.commission;
    }
  }
  for (const b of map.values()) b.items.sort((a, c) => c.datetime.localeCompare(a.datetime));
  return [...map.values()].sort((a, b) => b.commission - a.commission);
}

export interface DayPoint {
  date: string;
  sales: number;
  commission: number;
  count: number;
}

/** Daily totals across the inclusive range, zero-filled so the line is continuous. */
export function daily(rows: Row[], start: string, end: string): DayPoint[] {
  const map = new Map<string, DayPoint>();
  for (const r of rows) {
    if (!inRange(r, start, end)) continue;
    let p = map.get(r.date);
    if (!p) {
      p = { date: r.date, sales: 0, commission: 0, count: 0 };
      map.set(r.date, p);
    }
    p.sales += r.sale;
    p.commission += r.commission;
    p.count += 1;
  }
  const out: DayPoint[] = [];
  let cursor = start;
  // Cap zero-fill so an "all" range doesn't create thousands of empty days.
  const maxDays = 400;
  let guard = 0;
  while (cursor <= end && guard < maxDays) {
    out.push(map.get(cursor) ?? { date: cursor, sales: 0, commission: 0, count: 0 });
    cursor = addDays(cursor, 1);
    guard++;
  }
  // If the range exceeded the cap, fall back to only days that have data.
  if (cursor <= end) {
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  return out;
}

/** Inclusive [start, end] for a specific "YYYY-MM" month. */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** The "YYYY-MM" month before the given one. */
export function prevMonthKey(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Distinct months present in the data, newest first. */
export function availableMonths(rows: Row[]): string[] {
  const set = new Set<string>();
  for (const r of rows) set.add(r.date.slice(0, 7));
  return [...set].sort().reverse();
}

export interface MonthPoint {
  month: string; // "YYYY-MM"
  sales: number;
  commission: number;
  count: number;
}

/** Totals bucketed by calendar month, oldest→newest. `lastN` keeps only the most
 *  recent N months (0 = keep all). Ignores the date-range preset by design — the
 *  monthly view is a cross-month comparison, not a windowed slice. */
export function monthly(rows: Row[], lastN = 12): MonthPoint[] {
  const map = new Map<string, MonthPoint>();
  for (const r of rows) {
    const month = r.date.slice(0, 7);
    let p = map.get(month);
    if (!p) {
      p = { month, sales: 0, commission: 0, count: 0 };
      map.set(month, p);
    }
    p.sales += r.sale;
    p.commission += r.commission;
    p.count += 1;
  }
  const arr = [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  return lastN > 0 ? arr.slice(-lastN) : arr;
}

export interface DowAgg {
  dow: number; // 0=Sun … 6=Sat
  label: string;
  totalSale: number;
  totalComm: number;
  count: number;
  dayCount: number; // distinct dates falling on this weekday
  avgSale: number; // per occurrence of this weekday
  avgComm: number;
  avgCount: number;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Averages by weekday: total for each weekday divided by how many of that weekday
 *  actually occurred in the data. Returns Sun→Sat. */
export function byDayOfWeek(rows: Row[]): DowAgg[] {
  const map = new Map<number, { sale: number; comm: number; count: number; dates: Set<string> }>();
  for (const r of rows) {
    const dow = new Date(`${r.date}T00:00:00`).getDay();
    let a = map.get(dow);
    if (!a) {
      a = { sale: 0, comm: 0, count: 0, dates: new Set() };
      map.set(dow, a);
    }
    a.sale += r.sale;
    a.comm += r.commission;
    a.count += 1;
    a.dates.add(r.date);
  }
  return DOW_LABELS.map((label, dow) => {
    const a = map.get(dow);
    const dayCount = a ? a.dates.size : 0;
    return {
      dow,
      label,
      totalSale: a?.sale ?? 0,
      totalComm: a?.comm ?? 0,
      count: a?.count ?? 0,
      dayCount,
      avgSale: dayCount ? a!.sale / dayCount : 0,
      avgComm: dayCount ? a!.comm / dayCount : 0,
      avgCount: dayCount ? a!.count / dayCount : 0,
    };
  });
}

export { inRange };
