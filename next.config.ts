import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";

import { buildSecurityHeaders } from "./src/config/securityHeaders";

const withNextIntl = createNextIntlPlugin("./src/translations/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Keep Docker/WSL production builds below the native-memory peak that can
    // otherwise crash Node while Next.js is collecting output-file traces.
    webpackMemoryOptimizations: true,
  },
  // Vale para tudo o que sai do Next, inclusive as rotas de `/api`.
  async headers() {
    return [{ source: "/:path*", headers: buildSecurityHeaders() }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
