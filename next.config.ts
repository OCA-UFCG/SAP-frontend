import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/translations/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["chartjs-node-canvas", "canvas"],
  experimental: {
    // Keep Docker/WSL production builds below the native-memory peak that can
    // otherwise crash Node while Next.js is collecting output-file traces.
    webpackMemoryOptimizations: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
