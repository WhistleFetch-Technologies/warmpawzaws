const path = require('path');

/**
 * Next.js config – Vendor Web
 * Retained structure for AWS Serverless: static export → S3 + CloudFront.
 * Build for performance: compress, tree-shake, chunk splitting.
 * See docs/NEXTJS_AWS_SERVERLESS_ARCHITECTURE.md
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Expose API base URL to the client
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
  // Static export for S3/CloudFront (same as admin-web). Disable with ENABLE_STATIC_EXPORT=false for local server build.
  ...(process.env.NODE_ENV === 'production' && process.env.ENABLE_STATIC_EXPORT !== 'false'
    ? { output: 'export' }
    : {}),
  distDir: 'dist',
  reactStrictMode: true,
  transpilePackages: ['@warmpawz/ui', '@warmpawz/shared-libs'],
  swcMinify: true,
  compress: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // ✅ FIX: Add rewrites to proxy API requests to API Gateway in development
  async rewrites() {
    // Only apply rewrites in development mode (not in static export)
    if (process.env.NODE_ENV === 'development' && process.env.ENABLE_STATIC_EXPORT !== 'true') {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
      return [
        {
          source: '/chat/:path*',
          destination: `${apiBaseUrl}/chat/:path*`,
        },
        {
          source: '/api/:path*',
          destination: `${apiBaseUrl}/api/:path*`,
        },
      ];
    }
    return [];
  },
  experimental: {
    outputFileTracingExcludes: { '*': ['**/*'] },
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-switch',
    ],
  },
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  webpack: (config, { isServer }) => {
    const uiNodeModulesPath = path.resolve(__dirname, '../../packages/ui/node_modules');
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      uiNodeModulesPath,
      ...(config.resolve.modules || []),
    ];
    if (!config.resolve.alias) config.resolve.alias = {};
    if (!isServer && config.optimization?.splitChunks) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
      };
    }
    return config;
  },
};

module.exports = nextConfig;
