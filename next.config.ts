import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,

  serverExternalPackages: ["puppeteer", "sharp"],

  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },

  allowedDevOrigins: [
    "*.trycloudflare.com",
    "statutes-him-universal-mode.trycloudflare.com",
    "localhost"
  ],
};

export default nextConfig;
