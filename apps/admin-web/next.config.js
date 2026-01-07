/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  reactStrictMode: true,
  transpilePackages: ['@warmpawz/ui', '@warmpawz/shared-libs'],
  // IMPORTANT (Static export constraint):
  // Deployed to S3/CloudFront as static assets; runtime config is injected
  // via `/runtime-config.js` (generated during deploy).
  
  // Suppress hydration warnings during static export
  // Pages using client-side features will be statically generated with minimal content
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

