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
}

export interface ApiResponse {
  rows: Row[];
  /** When the underlying sheet was last successfully scraped (Status tab). */
  lastScrape: string | null;
  /** When this API response was generated (ISO). */
  fetchedAt: string;
}
