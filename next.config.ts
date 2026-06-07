import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.robinhood.com" },
    ],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
