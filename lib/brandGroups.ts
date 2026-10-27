/** Brands that run several stores (locations) under one partner. The sheet keeps each
 *  store as its own advertiser_id (so one store's refresh can't delete another's rows);
 *  the dashboard folds them into ONE brand and tags each row with its location. */
export const BRAND_GROUPS: Record<string, { id: string; name: string; location: string }> = {
  sixzero: { id: "sixzero", name: "Six Zero", location: "International (AUD)" },
  sixzerousa: { id: "sixzero", name: "Six Zero", location: "USA" },
  sixzerocanada: { id: "sixzero", name: "Six Zero", location: "Canada" },
};

/** Location filter options shown on a grouped brand's page. */
export const BRAND_LOCATIONS: Record<string, string[]> = {
  sixzero: ["USA", "Canada", "International (AUD)"],
};
