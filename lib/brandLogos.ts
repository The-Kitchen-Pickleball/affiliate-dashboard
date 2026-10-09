/**
 * Partner logos, keyed by advertiser_id (lowercase). The images are the profile
 * pictures the kitchen-social dashboard already pulls from each partner's
 * Instagram (Meta Business Discovery) and archives to Supabase Storage — so they
 * stay the brand's *current* logo and we don't re-host or hunt them ourselves.
 *
 * Public bucket URL: <SUPABASE_URL>/storage/v1/object/public/thumbnails/avatars/<slug>.jpg
 * The slug is kitchen-social's partner-name slug, which usually differs from our
 * advertiser_id — hence this explicit map. Brands without an entry (e.g. Mark,
 * SLAMIT — their IG lookups failed) render with no logo, handled by the caller.
 */
const LOGO_BASE =
  "https://slcdlyvalgfzldluorre.supabase.co/storage/v1/object/public/thumbnails/avatars";

/** advertiser_id (lowercase) → logo filename in the bucket. */
const LOGO_FILE: Record<string, string> = {
  "11six24": "11six24.jpg",
  aireo: "aireo.jpg",
  "bread-butter": "bread-butter.jpg",
  chorus: "chorus.jpg",
  crbn: "crbn.jpg",
  daps: "daps.jpg",
  diadem: "diadem.jpg",
  dominator: "dominator.jpg",
  engage: "engage.jpg",
  enhance: "enhance.jpg",
  erne: "erne.jpg",
  flik: "flik.jpg",
  franklin: "franklin.jpg",
  friday: "friday.jpg",
  gearbox: "gearbox.jpg",
  gherkin: "gherkin.jpg",
  "goaffpro-forwrd": "forwrd.jpg",
  forwrd: "forwrd.jpg",
  gruvn: "gruvn.jpg",
  head: "head.jpg",
  holbrook: "holbrook.jpg",
  honcho: "honcho.jpg",
  honolulu: "honolulu.jpg",
  joola: "joola.jpg",
  "joola-bundles": "joola.jpg",
  kitchenblockers: "kitchen-blockers.jpg",
  luzz: "luzz.jpg",
  neonic: "neonic.jpg",
  nox: "nox.jpg",
  paddletek: "paddletek.jpg",
  pickleballapes: "pickleball-apes.jpg",
  pickleballgetaways: "pickleball-getaways.jpg",
  proton: "proton.jpg",
  "rpm-pickleball": "rpm.jpg",
  selkirk: "selkirk.jpg",
  sixzero: "six-zero.jpg",
  slyce: "slyce.jpg",
  speedup: "speedup.jpg",
  thrive: "thrive.jpg",
  tonyroig: "tonyroig.jpg",
  udrippin: "udrippin.jpg",
  vatic: "vatic.jpg",
  volair: "volair.jpg",
  "warping-point": "warping-point.jpg",
};

/** Full public logo URL for a brand, or null if we don't have one. */
export function getBrandLogo(advertiserId: string): string | null {
  const file = LOGO_FILE[advertiserId.toLowerCase()];
  return file ? `${LOGO_BASE}/${file}` : null;
}
