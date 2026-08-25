/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@finpilot/shared-types', '@finpilot/shared-utils'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:4000/api/v1/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
