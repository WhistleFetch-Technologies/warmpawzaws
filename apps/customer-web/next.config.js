const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  reactStrictMode: true,
  transpilePackages: ['@warmpawz/ui', '@warmpawz/shared-libs'],
  // IMPORTANT (Static export constraint):
  // Do not rely on build-time env injection for API base URLs.
  // This app is deployed as static assets to S3/CloudFront, so runtime config
  // is provided via `/runtime-config.js` (generated during deploy).
  swcMinify: true,
  webpack: (config, { isServer }) => {
    // Configure webpack to resolve modules from packages/ui/node_modules
    // This ensures Next.js can find dependencies from the linked @warmpawz/ui package
    const uiNodeModulesPath = path.resolve(__dirname, '../../packages/ui/node_modules');
    
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      uiNodeModulesPath,
      ...(config.resolve.modules || []),
    ];
    
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    
    return config;
  },
};

module.exports = nextConfig;

