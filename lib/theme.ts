/** Validated categorical palette (dataviz skill default; passes CVD + lightness). */
export const SERIES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#4a3aa7",
] as const;

/** The Kitchen brand green as a CSS var so charts follow light/dark themes
 *  (dark forest green in light mode, neon green in dark mode). Recharts accepts
 *  CSS-variable color strings for stroke/fill. */
export const BRAND = "var(--brand)";
