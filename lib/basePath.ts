/**
 * The affiliate dashboard is served at dashboard.thekitchenpickle.com/affiliate:
 * the kitchen-social project owns the domain and rewrites /affiliate/* to this
 * project ("multi-zones"). Next prefixes pages/links/assets with basePath
 * automatically, but NOT plain fetch() URLs — use api() for those.
 */
export const BASE_PATH = "/affiliate";
export const api = (path: string) => `${BASE_PATH}${path}`;
