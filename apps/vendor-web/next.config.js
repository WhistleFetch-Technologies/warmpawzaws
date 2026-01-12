const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  reactStrictMode: true,
  transpilePackages: ['@warmpawz/ui', '@warmpawz/shared-libs'],
  // Disable outputFileTracing for static exports (not needed and causes build errors)
  experimental: {
    outputFileTracingExcludes: {
      '*': ['**/*'],
    },
  },
  // IMPORTANT (Static export constraint):
  // Deployed to S3/CloudFront as static assets; runtime config is injected
  // via `/runtime-config.js` (generated during deploy).
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

