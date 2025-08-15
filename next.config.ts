import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Vercel deployment configuration
  async headers() {
    return [
      {
        source: '/api/studios/:id/classes',
        headers: [
          {
            key: 'x-vercel-function-timeout',
            value: '300',
          },
        ],
      },
    ];
  },
  
  // Environment variables for build
  env: {
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
  },
  
  // ESLint configuration
  eslint: {
    dirs: ['app', 'lib', 'components'],
    ignoreDuringBuilds: false,
  },
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
