const path = require('path');
const { getDevDistDir } = require('./scripts/dev-cache-path.cjs');

/**
 * `distDir` for builds/starts vs dev. Dev must stay consistent in worker processes too:
 * `scripts/start-dev.cjs` sets WARMPAWZ_ADMIN_WEB_DEV_DISTDIR so reloads are not confused
 * when argv no longer equals `next dev`.
 */
function resolveDistDir() {
  const cmd = process.argv[2];
  if (cmd === 'build' || cmd === 'start') {
    return 'dist';
  }
  const fromEnv = process.env.WARMPAWZ_ADMIN_WEB_DEV_DISTDIR;
  if (fromEnv) {
    return fromEnv;
  }
  if (cmd === 'dev' || process.env.npm_lifecycle_event === 'dev') {
    return getDevDistDir(__dirname);
  }
  return 'dist';
}

/**
 * Next.js config – Admin Web
 * Retained structure for AWS Serverless: static export → S3 + CloudFront.
 * Build for performance: compress, tree-shake, chunk splitting.
 * See docs/NEXTJS_AWS_SERVERLESS_ARCHITECTURE.md
 *
 * Dev cache path: `scripts/dev-cache-path.cjs` (outside OneDrive on Windows when possible).
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.argv[2] === 'build' && process.env.NEXT_EXPORT !== 'false' ? { output: 'export' } : {}),
  distDir: resolveDistDir(),
  reactStrictMode: true,
  transpilePackages: [
    '@warmpawz/ui',
    '@warmpawz/shared-libs',
    '@warmpawz/shared-types',
    '@warmpawz/promotion-management-ui',
    '@warmpawz/commercial-campaign-ui',
    '@warmpawz/commerce-switch-contracts',
  ],
  swcMinify: true,
  compress: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: process.env.WARMPAWZ_ADMIN_IGNORE_TS === '1' },
  eslint: { ignoreDuringBuilds: process.env.WARMPAWZ_ADMIN_IGNORE_TS === '1' },
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
      path.resolve(__dirname),
      path.resolve(__dirname, 'node_modules'),
      uiNodeModulesPath,
      ...(config.resolve.modules || []),
    ];
    if (!config.resolve.alias) config.resolve.alias = {};
    config.resolve.alias['@warmpawz/shared-types'] = path.resolve(
      __dirname,
      '../../packages/shared-types/src/index.ts'
    );
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
