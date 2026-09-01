export type Status = "pending" | "approved" | "declined";

/** One commission row, normalized for the dashboard. Money is in DOLLARS here
 *  (the sheet stores integer cents; the API converts once at the boundary). */
export interface Row {
  transactionId: string;
  advertiserId: string;
  advertiser: string;
  /** ISO date string "YYYY-MM-DD" in Central time (time-of-day dropped for bucketing). */
  date: string;
  /** Full "YYYY-MM-DD HH:MM:SS" as stored, for exact sorting. */
  datetime: string;
  sale: number;
  commission: number;
  status: Status;
  /** Real number of underlying orders this row represents. 1 for normal per-order
   *  rows; for RPM (delta-based) a single row bundles many orders, so this carries
   *  the true count (from `order_ref`) and the dashboard sums it for "# of Sales". */
  orders: number;
}

/** A live data-health problem surfaced as a banner on the dashboard. */
export interface HealthIssue {
  severity: "error" | "warn";
  message: string;
}

export interface ApiResponse {
  rows: Row[];
  /** When the underlying sheet was last successfully scraped (Status tab). */
  lastScrape: string | null;
  /** Live health checks (RPM vs platform, per-brand drift, stale scraper). */
  health: HealthIssue[];
  /** When this API response was generated (ISO). */
  fetchedAt: string;
}
