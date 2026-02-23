import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
