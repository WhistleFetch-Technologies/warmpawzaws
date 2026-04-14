const path = require('path');

/** True when the CLI is `next dev` (do not use NODE_ENV — .env.local often sets production and breaks dev). */
const isNextDev = process.argv[2] === 'dev';

/**
 * Next.js config – Admin Web
 * Retained structure for AWS Serverless: static export → S3 + CloudFront.
 * Build for performance: compress, tree-shake, chunk splitting.
 * See docs/NEXTJS_AWS_SERVERLESS_ARCHITECTURE.md
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.argv[2] === 'build' && process.env.NEXT_EXPORT !== 'false' ? { output: 'export' } : {}),
  // Dev uses `.next` so OneDrive/reparse points under `dist` do not break `next dev`. Builds use `dist` for S3 deploy.
  distDir: isNextDev ? '.next' : 'dist',
  reactStrictMode: true,
  transpilePackages: ['@warmpawz/ui', '@warmpawz/shared-libs'],
  swcMinify: true,
  compress: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: false },
  experimental: {
    outputFileTracingExcludes: process.argv[2] === 'build' ? { '*': ['**/*'] } : undefined,
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
