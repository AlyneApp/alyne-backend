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
      // CORS headers for all API routes
      // Note: Access-Control-Allow-Credentials cannot be used with wildcard origin
      // The middleware handles dynamic CORS headers based on the request origin
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // Allow all origins (mobile apps may not send origin header)
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
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
  
  // Webpack configuration to exclude Node.js-only packages
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js-only packages from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    // Ignore problematic files and modules
    config.plugins = config.plugins || [];
    const webpack = require('webpack');
    
    // Ignore HTML files and problematic modules from node-pre-gyp
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    
    // Add rule to ignore HTML files from node-pre-gyp (must be before other rules)
    config.module.rules.unshift({
      test: /\.html$/,
      include: /node_modules\/@mapbox\/node-pre-gyp/,
      use: 'null-loader',
    });
    
    // Ignore problematic modules using IgnorePlugin (multiple plugins for better coverage)
    config.plugins.push(
      // First: Ignore HTML files specifically from the sync pattern
      new webpack.IgnorePlugin({
        resourceRegExp: /\.html$/,
        contextRegExp: /node_modules\/@mapbox\/node-pre-gyp/,
      }),
      // Second: Ignore the nw-pre-gyp directory entirely
      new webpack.IgnorePlugin({
        resourceRegExp: /nw-pre-gyp/,
        contextRegExp: /node_modules\/@mapbox\/node-pre-gyp/,
      }),
      // Third: Ignore optional dependencies
      new webpack.IgnorePlugin({
        resourceRegExp: /^(mock-aws-s3|aws-sdk|nock|node-gyp|npm)$/,
      }),
      // Fourth: Comprehensive check for any HTML files from node-pre-gyp
      new webpack.IgnorePlugin({
        checkResource(resource: string, context: string) {
          // Ignore HTML files from node-pre-gyp
          if (resource && resource.includes('.html')) {
            if (context && context.includes('@mapbox/node-pre-gyp')) {
              return true;
            }
            if (resource.includes('@mapbox/node-pre-gyp')) {
              return true;
            }
          }
          // Ignore nw-pre-gyp directory
          if (resource && resource.includes('@mapbox/node-pre-gyp/lib/util/nw-pre-gyp')) {
            return true;
          }
          return false;
        },
      })
    );
    
    // Exclude tfjs-node from being bundled (only use it server-side)
    if (!isServer) {
      config.externals = config.externals || [];
      if (typeof config.externals === 'object' && !Array.isArray(config.externals)) {
        config.externals = [config.externals];
      }
      config.externals.push({
        '@tensorflow/tfjs-node': 'commonjs @tensorflow/tfjs-node',
        'sharp': 'commonjs sharp',
      });
    }
    
    return config;
  },
};

export default nextConfig;
