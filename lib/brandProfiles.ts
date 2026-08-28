/**
 * Per-brand profile data shown on a brand's detail page.
 *
 * Source of truth: the "Affiliate Partners" Notion database
 * (https://app.notion.com/p/Affiliate-Partners-1e04b3848bfc8098b7e1dad02417fca2).
 * These are the NON-SECRET fields only — platform, dashboard URL, commission %,
 * discount code, store link, etc. Login email + password are NOT here; they're
 * served separately from a Vercel secret behind the login gate (see
 * app/api/credentials/route.ts). Keyed by advertiser_id (the slug from the sheet).
 *
 * To refresh: re-query the Notion DB and regenerate this file.
 */
export type Connected = "Connected" | "Disconnected" | "Manual Process";

export interface BrandProfile {
  platform: string;
  /** Affiliate dashboard / login URL for the platform. */
  platformUrl?: string;
  /** Commission rate as a fraction, e.g. 0.12 = 12%. null when N/A (e.g. own-store). */
  commissionPct: number | null;
  /** Discount code the buyer uses, e.g. "KITCHEN". */
  code?: string;
  /** What the code gives the buyer, e.g. "10% off". */
  discount?: string;
  /** Public homepage affiliate link (store). */
  storeLink?: string;
  attributionWindow?: string;
  connected?: Connected;
  notes?: string;
}

export const BRAND_PROFILES: Record<string, BrandProfile> = {
  "11six24": { platform: "UpPromote", platformUrl: "https://af.uppromote.com/11six24-pickleball/login", commissionPct: 0.12, code: "KITCHEN", discount: "$10 off", storeLink: "https://11six24.com?sca_ref=10025104.iydezxEpou", connected: "Connected" },
  aireo: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/qm0wg4-ay/login", commissionPct: 0.25, code: "KITCHEN", discount: "10% off", storeLink: "https://www.aireo-sports.com?sca_ref=11228945.lMdRMRhV8AObidn", connected: "Connected" },
  "bread-butter": { platform: "Impact", platformUrl: "https://app.impact.com/bla/Bread-and-Butter-Pickleball-Co/login.user", commissionPct: 0.1, code: "KITCHEN", discount: "10% off", storeLink: "https://breadbutterpickleballco.sjv.io/5kAnP2", connected: "Connected" },
  chorus: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/647c98-4/login", commissionPct: 0.1, code: "KITCHEN", discount: "10% off", storeLink: "https://choruspickleball.com?sca_ref=10908630.QNHYm4NWZcF", connected: "Connected" },
  crbn: { platform: "SocialSnowball", platformUrl: "https://affiliates.socialsnowball.io/auth/affiliate/login", commissionPct: 0.2, code: "KITCHEN", discount: "10% off", storeLink: "https://www.crbnpickleball.com/discount/KITCHEN", connected: "Connected" },
  daps: { platform: "SocialSnowball", platformUrl: "https://affiliates.socialsnowball.io/affiliate/dashboard/partnerships/76316684/home", commissionPct: 0.21, code: "KITCHEN", discount: "15% off", storeLink: "https://www.daps.fit/KITCHEN", connected: "Connected" },
  diadem: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/diademsports/login", commissionPct: 0.15, code: "KITCHEN", discount: "10% off", storeLink: "https://diademsports.com?sca_ref=9835156.lrczGA9BQJRwKSi", connected: "Connected", notes: "Postback URL enabled; added to WeCanTrack" },
  dominator: { platform: "Current (in-house)", platformUrl: "https://dominator.current.tech/home", commissionPct: 0.15, code: "KITCHEN", discount: "10% off", storeLink: "https://crrnt.app/WEIG/oO86QEka", connected: "Connected" },
  engage: { platform: "SocialSnowball", platformUrl: "https://affiliates.socialsnowball.io/auth/affiliate/login", commissionPct: 0.4, code: "KITCHEN", discount: "10% off (20KITCHEN = 20% off)", storeLink: "https://www.engagepickleball.com/kitchen", connected: "Connected" },
  enhance: { platform: "SocialSnowball", platformUrl: "https://affiliates.socialsnowball.io/affiliate/dashboard/home", commissionPct: 0.3, code: "KITCHEN", discount: "$20 off", storeLink: "https://www.enhancepickleball.com/KITCHEN", connected: "Connected" },
  erne: { platform: "SocialSnowball", platformUrl: "https://affiliates.socialsnowball.io/auth/affiliate/login", commissionPct: 0.12, code: "KITCHEN", discount: "5% off", storeLink: "https://www.ernepickleballmachine.com/KITCHEN", connected: "Connected", notes: "Manual login — Refersion emails a login link" },
  flik: { platform: "GoAffPro", platformUrl: "https://flikpickleball.goaffpro.com/", commissionPct: 0.2, code: "KITCHEN", discount: "10% off", storeLink: "https://flikpickleball.com/?ref=KITCHEN", connected: "Connected" },
  franklin: { platform: "Impact", platformUrl: "https://app.impact.com/", commissionPct: 0.13, code: "KITCHEN", discount: "15% off", storeLink: "https://franklinsports.sjv.io/vNyL33", connected: "Connected" },
  friday: { platform: "SocialSnowball", platformUrl: "https://affiliates.socialsnowball.io/auth/affiliate/login", commissionPct: 0.2, code: "KITCHEN", discount: "$10 off", storeLink: "https://www.fridaypickle.com/KITCHEN", connected: "Connected" },
  gearbox: { platform: "Refersion", platformUrl: "https://gearbox.refersion.com/affiliate", commissionPct: 0.2, code: "KITCHEN", discount: "10% off", storeLink: "https://gearboxsports.com/?rfsn=8913951.bd4409", connected: "Disconnected", notes: "Manual login — Refersion emails a login link" },
  gherkin: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/GherkinUSA/login", commissionPct: 0.125, code: "KITCHEN", discount: "10% off", storeLink: "https://www.gherkinusa.com?sca_ref=10909599.8qMhQKq3lNEWKM", connected: "Connected" },
  "goaffpro-forwrd": { platform: "GoAffPro", platformUrl: "https://forwrd.goaffpro.com/login", commissionPct: 0.15, code: "KITCHEN", discount: "5% off", storeLink: "https://forwrd.co/?ref=eixrxnja", connected: "Connected", notes: "Low commissions; needs custom integration" },
  gruvn: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/gruvn/login", commissionPct: 0.2, code: "KITCHENPB", discount: "10% off", storeLink: "https://gruvn.co?sca_ref=10258590.e4hRYBKQIZhrJ", connected: "Connected" },
  head: { platform: "Awin", platformUrl: "https://ui.awin.com/idp/us/awin/login/prelogin?redirect=%2Flogin%3FnetworkGroup%3Dawin", commissionPct: 0.3, code: "KITCHEN", discount: "15% off", storeLink: "https://www.awin1.com/cread.php?awinmid=27978&awinaffid=2927569", connected: "Connected" },
  holbrook: { platform: "UpPromote", platformUrl: "https://ambassadors.holbrookpickleball.com/login", commissionPct: 0.15, code: "KITCHEN", discount: "15% off", storeLink: "https://holbrookpickleball.com/Kitchen", connected: "Connected", notes: "Captcha solver" },
  honolulu: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/4009c8-2/login", commissionPct: 0.275, code: "KITCHEN", discount: "10% off", storeLink: "https://808pickle.com?sca_ref=10282613.wUHrpmxXWt", connected: "Connected", notes: "Captcha solver" },
  joola: { platform: "BixGrow (Shopify)", platformUrl: "https://affiliate.joola.com/login", commissionPct: 0.15, code: "NA", discount: "", storeLink: "https://joola-usa.myshopify.com?bg_ref=ibGahSCAYb", connected: "Connected" },
  "joola-bundles": { platform: "Shopify (direct bundles)", commissionPct: null, code: "NA", discount: "", storeLink: "https://joola-usa.myshopify.com?bg_ref=ibGahSCAYb", connected: "Connected", notes: "Direct JOOLA-bundle store sales; 'commission' = sale − Shopify fees (2.9% + $0.30)" },
  luzz: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/010661-db/login", commissionPct: 0.2, code: "KITCHEN", discount: "15% off", storeLink: "https://luzzpickleball.com?sca_ref=10189049.OP2LCNcyfP", connected: "Connected", notes: "Captcha solver" },
  mark: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/495311-2/login", commissionPct: 0.1, code: "KITCHEN", discount: "10% off", connected: "Connected" },
  neonic: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/neonic-pickleball/login", commissionPct: 0.1, code: "KITCHEN", discount: "10% off", storeLink: "https://neonicpickleball.com/?sca_ref=10905188.LKXfrcCWu5N", connected: "Connected" },
  paddletek: { platform: "Shortly", platformUrl: "https://shortly.link/influencer/dashboard", commissionPct: 0.2, code: "KITCHEN", discount: "10% off", storeLink: "https://www.paddletek.com/TheKitchen", connected: "Connected" },
  pickleballapes: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/pickleballapes/login", commissionPct: 0.4, code: "KITCHEN", discount: "10% off", storeLink: "https://www.pickleballapes.com?sca_ref=10608763.F2hARHEsYHG3Rmz1", connected: "Connected", notes: "Postback URL not enabled — needs scraper support" },
  proton: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/proton-sports-inc/login", commissionPct: 0.5, code: "KITCHEN", discount: "15% off", storeLink: "https://protonsports.com/discount/kitchen", connected: "Connected" },
  "rpm-pickleball": { platform: "Shopify Collabs", platformUrl: "https://www.shopify.com/collabs/creators", commissionPct: 0.4, code: "KITCHEN", discount: "15% off", storeLink: "https://rpmpb.com/KITCHEN", connected: "Connected", notes: "Estimated — Shopify Collabs has no API; figures reconstructed from daily snapshots" },
  selkirk: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/selkirk-sport/login", commissionPct: 0.15, code: "INF-KITCHEN", discount: "coupon toward future purchase", storeLink: "https://www.selkirk.com?sca_ref=11206974.LjrPkTV3Ngqj5BdI", connected: "Connected" },
  sixzero: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/six-zero-7668", commissionPct: 0.15, code: "KITCHEN", discount: "10% off", storeLink: "https://www.sixzeropickleball.com?sca_ref=4355001.YZeYJiXGHC", connected: "Connected" },
  slamit: { platform: "GoAffPro", platformUrl: "https://slamit.goaffpro.com/", commissionPct: 0.2, code: "THEKITCHEN", discount: "15% off", storeLink: "https://slamit.com/pages/pickleball?ref=THEKITCHEN", connected: "Connected" },
  slyce: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/d7fa5b-2/login", commissionPct: 0.1, code: "KITCHEN", discount: "10% off", storeLink: "https://slycesport.com?sca_ref=11884980.71zT4TJbZdI3V9", connected: "Connected" },
  speedup: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/speeduppickle/login", commissionPct: 0.15, code: "KITCHEN", discount: "10% off", storeLink: "https://speeduppickle.com?sca_ref=10866486.wyeR1U0Isb", connected: "Connected" },
  thrive: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/thrive-pickleball/login", commissionPct: 0.1, code: "KITCHEN", discount: "10% off", storeLink: "https://thrivepb.com?sca_ref=11001061.UqMouT5XmP", connected: "Connected" },
  udrippin: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/Udrippin/dashboard", commissionPct: 0.3, code: "KITCHEN", discount: "15% off", storeLink: "https://www.udrippin.com?sca_ref=9600162.Wqqf4T7186", connected: "Connected" },
  vatic: { platform: "UpPromote", platformUrl: "https://af.uppromote.com/vatic-pro/login", commissionPct: 0.1, code: "KITCHEN", discount: "$10 off", storeLink: "https://vaticpro.com?sca_ref=9987972.Fsd1ZyC8aT", connected: "Connected" },
  volair: { platform: "Refersion", platformUrl: "https://www.refersion.com/affiliate/login", commissionPct: 0.1, code: "KITCHEN", discount: "10% off", connected: "Connected", notes: "Manual login — Refersion emails a login link" },
  "warping-point": { platform: "GoAffPro", platformUrl: "https://warpingpoint.goaffpro.com/", commissionPct: 0.15, code: "KITCHEN", discount: "10% off", storeLink: "https://warpingpoint.com/?ref=KITCHEN", connected: "Connected" },
};

export function getBrandProfile(advertiserId: string): BrandProfile | undefined {
  return BRAND_PROFILES[advertiserId.toLowerCase()];
}
