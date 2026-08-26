import type { MetadataRoute } from "next";

// Internal dashboard — disallow all crawlers entirely (second layer on top of
// the login gate and the noindex meta in layout.tsx).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
