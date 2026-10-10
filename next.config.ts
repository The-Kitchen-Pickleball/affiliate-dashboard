import type { NextConfig } from "next";

// Served under dashboard.thekitchenpickle.com/affiliate (see lib/basePath.ts).
const nextConfig: NextConfig = {
  basePath: "/affiliate",
  async redirects() {
    // The old address (affiliate-dashboard-flax.vercel.app) → the new one, so
    // bookmarks keep working. Only the bare root: the main domain forwards
    // /affiliate/* here, so redirecting those paths would loop. Production only.
    if (process.env.VERCEL_ENV !== "production") return [];
    return [
      {
        source: "/",
        destination: "https://dashboard.thekitchenpickle.com/affiliate",
        basePath: false,
        permanent: false,
        has: [{ type: "host", value: "affiliate-dashboard-flax.vercel.app" }],
      },
    ];
  },
};

export default nextConfig;
