const path = require('path');

/**
 * Next.js config – Vendor Web
 * Retained structure for AWS Serverless: static export → S3 + CloudFront.
 * Build for performance: compress, tree-shake, chunk splitting.
 * See docs/NEXTJS_AWS_SERVERLESS_ARCHITECTURE.md
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
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
