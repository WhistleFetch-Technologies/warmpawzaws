const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export for production builds, not for dev mode
  ...(process.env.NODE_ENV === 'production' && process.env.NEXT_EXPORT !== 'false' ? { output: 'export' } : {}),
  distDir: 'dist',
  reactStrictMode: true,
  transpilePackages: ['@warmpawz/ui', '@warmpawz/shared-libs'],
  // IMPORTANT (Static export constraint):
  // Deployed to S3/CloudFront as static assets; runtime config is injected
  // via `/runtime-config.js` (generated during deploy).
  // For local dev, we disable static export to allow dynamic rendering.
  
  // Suppress hydration warnings during static export
  // Pages using client-side features will be statically generated with minimal content
  images: {
    unoptimized: true,
  },
  // Configure webpack to resolve modules from packages/ui/node_modules
  webpack: (config, { isServer }) => {
    // Add packages/ui/node_modules to module resolution paths
    // This ensures Next.js can find dependencies from the linked @warmpawz/ui package
    const uiNodeModulesPath = path.resolve(__dirname, '../../packages/ui/node_modules');
    
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      uiNodeModulesPath,
      ...(config.resolve.modules || []),
    ];
    
    // Also add to fallback resolution for better module resolution
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    
    return config;
  },
};

module.exports = nextConfig;

