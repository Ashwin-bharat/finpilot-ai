/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@finpilot/shared-types', '@finpilot/shared-utils'],
  allowedDevOrigins: ['*.trycloudflare.com', '*.loca.lt', '*.ngrok-free.app'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://127.0.0.1:4000/api/v1/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
