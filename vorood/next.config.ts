import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Keep Turbopack rooted on this app when nested inside the portfolio monorepo.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
