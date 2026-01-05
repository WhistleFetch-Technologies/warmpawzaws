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
};

module.exports = nextConfig;

