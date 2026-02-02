/** @type {import('next').NextConfig} */
const nextConfig = {
  //this makes the Next.js know what domain it could trust!!
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

module.exports = nextConfig;