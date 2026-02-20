import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  //explicitar quais domínios de imagens são aceitos 
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
    ],
  },
  reactCompiler: true,
};

export default nextConfig;
