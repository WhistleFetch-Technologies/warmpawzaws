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
};

module.exports = nextConfig;

