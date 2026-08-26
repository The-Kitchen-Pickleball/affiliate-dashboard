export function usd(n: number, opts: { cents?: boolean } = {}): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: opts.cents === false ? 0 : 2,
  });
}

export function num(n: number): string {
  return n.toLocaleString("en-US");
}

/** "Aug 26" style short date from an ISO "YYYY-MM-DD". */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Formats the scrape heartbeat ("YYYY-MM-DD HH:MM:SS") as "Aug 26, 2026, 12:11:07 PM". */
export function heartbeatLabel(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return s;
  const [, y, mo, d, hh, mm, ss] = m.map(Number) as unknown as number[];
  return new Date(y, mo - 1, d, hh, mm, ss).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/** "Aug '26" style label from an ISO "YYYY-MM" month key. */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" })} '${String(y).slice(2)}`;
}

/** Signed percent change, or null when there's no valid baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
