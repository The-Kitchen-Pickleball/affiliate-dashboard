/**
 * Affiliate-portal login URLs per brand, keyed by advertiser_id (lowercase).
 * Clicking a brand in the table opens its portal in a new tab.
 *
 * Sources: the scraper configs (UpPromote ACCOUNT_BASE_URLS + `/login`, GoAffPro
 * baseUrls, etc.). UpPromote's login path is `{baseUrl}/login` (confirmed by the
 * scraper's own login-page URL). Brands not listed render as plain text — add a
 * line here to give them a link.
 */
export const BRAND_LOGIN_URLS: Record<string, string> = {
  // UpPromote — affiliate login at {baseUrl}/login
  luzz: "https://af.uppromote.com/010661-db/login",
  honolulu: "https://af.uppromote.com/4009c8-2/login",
  holbrook: "https://ambassadors.holbrookpickleball.com/holbrookpickleball/login",
  diadem: "https://af.uppromote.com/diademsports/login",
  pickleballapes: "https://af.uppromote.com/pickleballapes/login",
  udrippin: "https://af.uppromote.com/Udrippin/login",
  "11six24": "https://af.uppromote.com/11six24-pickleball/login",
  vatic: "https://af.uppromote.com/vatic-pro/login",
  gruvn: "https://af.uppromote.com/gruvn/login",
  sixzero: "https://af.uppromote.com/six-zero-7668/login",
  neonic: "https://af.uppromote.com/neonic-pickleball/login",
  chorus: "https://af.uppromote.com/647c98-4/login",
  thrive: "https://af.uppromote.com/thrive-pickleball/login",
  mark: "https://af.uppromote.com/495311-2/login",
  gherkin: "https://af.uppromote.com/GherkinUSA/login",
  proton: "https://af.uppromote.com/proton-sports-inc/login",
  aireo: "https://af.uppromote.com/qm0wg4-ay/login",
  selkirk: "https://af.uppromote.com/selkirk-sport/login",
  speedup: "https://af.uppromote.com/speeduppickle/login",
  slyce: "https://af.uppromote.com/d7fa5b-2/login",

  // GoAffPro — affiliate portal (redirects to login)
  "goaffpro-forwrd": "https://forwrd.goaffpro.com/login",
  forwrd: "https://forwrd.goaffpro.com/login",
  "warping-point": "https://warpingpoint.goaffpro.com/login",
  slamit: "https://slamit.goaffpro.com/login",
  flik: "https://flikpickleball.goaffpro.com/login",

  // SocialSnowball — shared affiliate portal
  enhance: "https://affiliates.socialsnowball.io/",
  crbn: "https://affiliates.socialsnowball.io/",
  friday: "https://affiliates.socialsnowball.io/",
  engage: "https://affiliates.socialsnowball.io/",
  erne: "https://affiliates.socialsnowball.io/",
  daps: "https://affiliates.socialsnowball.io/",

  // RPM — Shopify Collabs
  rpm: "https://collabs.shopify.com/",

  // Refersion
  gearbox: "https://www.refersion.com/affiliate/login/",
  volair: "https://www.refersion.com/affiliate/login/",

  // Pickleball Getaways — AffiliateWP
  pickleballgetaways: "https://pickleballgetaways.com/affiliate-login/",
};

export function getBrandLoginUrl(advertiserId: string): string | undefined {
  return BRAND_LOGIN_URLS[advertiserId.toLowerCase()];
}
