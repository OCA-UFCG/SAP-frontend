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
  async redirects() {
    return [
      {
        source: '/about',
        destination: '/quem-somos',
        permanent: true, 
      },
    ];
  },
};

export default nextConfig;
