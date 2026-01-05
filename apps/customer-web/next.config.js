/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  reactStrictMode: true,
  transpilePackages: ['@warmpawz/ui', '@warmpawz/shared-libs'],
  env: {
    // CRITICAL: Never fallback to production URL
    // Build will fail if NEXT_PUBLIC_API_BASE_URL is not set
    // This prevents accidental calls to production API from dev/staging
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('NEXT_PUBLIC_API_BASE_URL environment variable is required for production builds');
      }
      // Local development fallback
      return 'http://localhost:3000/api';
    })(),
    NEXT_PUBLIC_UAT_MODE: process.env.NEXT_PUBLIC_UAT_MODE || 'false',
  },
};

module.exports = nextConfig;

