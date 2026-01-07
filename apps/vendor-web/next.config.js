/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  reactStrictMode: true,
  transpilePackages: ['@warmpawz/ui', '@warmpawz/shared-libs'],
  // IMPORTANT (Static export constraint):
  // Deployed to S3/CloudFront as static assets; runtime config is injected
  // via `/runtime-config.js` (generated during deploy).
};

module.exports = nextConfig;

