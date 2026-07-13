const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

// Fallback API base URL for local dev (when NEXT_PUBLIC_API_BASE_URL not set)
let defaultApiUrl = '';
try {
  const urlsPath = path.join(__dirname, '../../config/urls.json');
  if (fs.existsSync(urlsPath)) {
    const urls = JSON.parse(fs.readFileSync(urlsPath, 'utf8'));
    defaultApiUrl = urls.apiGatewayDefaultUrl || '';
  }
} catch (_) {}

/**
 * Next.js config – Customer Web
 * Retained structure for AWS Serverless: static export → S3 + CloudFront.
 * Build for performance: compress, tree-shake, chunk splitting.
 * See docs/NEXTJS_AWS_SERVERLESS_ARCHITECTURE.md
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Local dev: use config/urls.json apiGatewayDefaultUrl when NEXT_PUBLIC_API_BASE_URL not set
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || defaultApiUrl,
  },
  // Only use static export in production builds, not in development
  // This allows dynamic routes to work in dev mode
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  // Prod: `dist` for static export + deploy scripts (see scripts/deploy-customer-web.sh).
  // Dev must stay under this app dir (e.g. `.next`): output outside the project breaks `require('react/...')`
  // resolution for compiled server chunks. If OneDrive causes EBUSY on `.next`, move the repo off OneDrive,
  // pause sync while developing, or exclude `apps/customer-web/.next` from backup/sync tools.
  distDir:
    process.env.NODE_ENV === 'production'
      ? 'dist'
      : process.env.NEXT_DEV_DIST_DIR || '.next',
  reactStrictMode: true,
  transpilePackages: [
    '@warmpawz/ui',
    '@warmpawz/shared-libs',
    '@warmpawz/service-launch-mappings',
    '@warmpawz/shared-types',
  ],
  swcMinify: true,
  compress: true,
  // Allow dev exports to proceed even if there are transient type or lint issues
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    outputFileTracingExcludes: {
      '*': ['**/*'],
    },
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-switch',
      'framer-motion',
      'date-fns',
    ],
  },
  
  // Modular imports for better tree-shaking
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  
  // ✅ FIX: Add rewrites to proxy API requests to API Gateway in development
  async rewrites() {
    // Only apply rewrites in development mode (not in static export)
    if (process.env.NODE_ENV === 'development' && process.env.ENABLE_STATIC_EXPORT !== 'true') {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || defaultApiUrl || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
      return [
        {
          source: '/chat/:path*',
          destination: `${apiBaseUrl}/chat/:path*`,
        },
      ];
    }
    return [];
  },
  
  webpack: (config, { isServer, dev }) => {
    // #region agent log
    try {
      const messagingPkg = path.resolve(__dirname, 'node_modules/@capacitor-firebase/messaging/package.json');
      const logLine =
        JSON.stringify({
          sessionId: '0135ea',
          hypothesisId: 'A',
          location: 'next.config.js:webpack',
          message: 'capacitor-firebase messaging install check',
          data: { installed: fs.existsSync(messagingPkg), messagingPkg },
          timestamp: Date.now(),
          runId: process.env.DEBUG_RUN_ID || 'verify',
        }) + '\n';
      fs.appendFileSync(path.resolve(__dirname, '../../debug-0135ea.log'), logLine);
    } catch (_) {}
    // #endregion
    // Configure webpack to resolve modules from packages/ui/node_modules
    // This ensures Next.js can find dependencies from the linked @warmpawz/ui package
    const uiNodeModulesPath = path.resolve(__dirname, '../../packages/ui/node_modules');
    
    // Do not prepend project root here — it breaks `@/` path alias resolution (webpack treats `@/…` oddly).
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      uiNodeModulesPath,
      ...(config.resolve.modules || []),
    ];
    
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    // Workspace package: ensures dev works if file: link under node_modules/@warmpawz is missing (fresh clone).
    config.resolve.alias['@warmpawz/shared-types'] = path.resolve(
      __dirname,
      '../../packages/shared-types/src/index.ts'
    );
    // Tsconfig `paths` `@/*` is not applied to webpack in this Windows/Next combo; rewrite `@/…` explicitly.
    if (!config.plugins) config.plugins = [];
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^@\//, (resource) => {
        const rel = resource.request.slice(2);
        resource.request = path.resolve(__dirname, rel);
      })
    );
    
    // Custom splitChunks with fixed names breaks Next dev chunk URLs; keep defaults in dev.
    if (!isServer && !dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          cacheGroups: {
            ...config.optimization?.splitChunks?.cacheGroups,
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            framer: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer-motion',
              chunks: 'all',
              priority: 20,
            },
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'radix-ui',
              chunks: 'all',
              priority: 20,
            },
          },
        },
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;

