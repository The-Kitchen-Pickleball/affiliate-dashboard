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

/** One line of the health report (scraper freshness, RPM vs platform, brand drift,
 *  data anomalies). Rendered in the health modal; non-ok ones also drive the banner. */
export interface HealthCheck {
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
  /** Stable signature for a dismissible warning. Present only on warn-level checks;
   *  errors can never be dismissed. Changes if the underlying entities change, so a
   *  dismissed alert reappears when it's actually a new problem. */
  dismissId?: string;
}

/** Per-brand payout state, from the Audit Aggregates tab. Only brands whose
 *  platform reports payout status (SocialSnowball, UpPromote that tracks paid). */
export interface PayoutRow {
  advertiserId: string;
  /** True when the platform reports a real paid history (paid > 0), so paid/owed
   *  are trustworthy. False = "can't be tracked" (pays off-platform or no data). */
  tracked: boolean;
  /** Commission the platform records as already paid out to us (dollars). */
  paid: number;
  /** Approved commission not yet paid — what the brand still owes us (dollars). */
  outstanding: number;
  total: number;
  /** Most recent completed-payout date ("YYYY-MM-DD"), or null if not captured. */
  lastPayout: string | null;
}

export interface ApiResponse {
  rows: Row[];
  /** When the underlying sheet was last successfully scraped (Status tab). */
  lastScrape: string | null;
  /** Live health checks run on every load (shown in the health modal + banner). */
  checks: HealthCheck[];
  /** Per-brand paid-vs-owed, for brands whose platform reports payout status. */
  payouts: PayoutRow[];
  /** When this API response was generated (ISO). */
  fetchedAt: string;
}
