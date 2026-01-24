/**
 * ============================================================================
 * ESBUILD CONFIGURATION FOR AWS LAMBDA DEPLOYMENT
 * ============================================================================
 * 
 * Bundles TypeScript handlers for AWS Lambda with:
 * - CloudFront compatibility
 * - RDS PostgreSQL support
 * - Cognito JWT validation
 * - API Gateway integration
 * 
 * Usage: npm run build
 * ============================================================================
 */

const esbuild = require('esbuild');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

esbuild.build({
  entryPoints: ['src/handler/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/handler.js',
  
  // External dependencies (AWS SDK, native modules)
  // These are provided by Lambda runtime or bundled separately
  external: [
    '@aws-sdk/*',
    'aws-lambda',
    'pg-native', // Native PostgreSQL module
    '@opensearch-project/opensearch',
    '@opensearch-project/opensearch/aws',
    // Mark these as external - they'll be included in package via serverless.yml patterns
    'pg',
    'jose',
    'firebase-admin',
    'zod',
    'hono',
  ],
  
  // Exclude old non-enhanced handlers from bundle
  // Only bundle enhanced handlers and core infrastructure
  packages: 'bundle',
  
  format: 'cjs', // CommonJS for Lambda
  sourcemap: !isProduction,
  minify: isProduction,
  
  // Node paths for proper module resolution
  nodePaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '../../node_modules'),
  ],
  
  // Resolve path aliases for API contracts
  alias: {
    '@warmpawz/api-contracts': path.resolve(__dirname, '../../packages/api-contracts/dist/index.js'),
    '@warmpawz/api-contracts/auth': path.resolve(__dirname, '../../packages/api-contracts/dist/auth.js'),
    '@warmpawz/api-contracts/bookings': path.resolve(__dirname, '../../packages/api-contracts/dist/bookings.js'),
    '@warmpawz/api-contracts/vendors': path.resolve(__dirname, '../../packages/api-contracts/dist/vendors.js'),
    '@warmpawz/api-contracts/customers': path.resolve(__dirname, '../../packages/api-contracts/dist/customers.js'),
    '@warmpawz/api-contracts/payments': path.resolve(__dirname, '../../packages/api-contracts/dist/payments.js'),
    '@warmpawz/api-contracts/common': path.resolve(__dirname, '../../packages/api-contracts/dist/common/index.js'),
  },
  
  // AWS Lambda specific settings
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
  },
  
  // Logging
  logLevel: isProduction ? 'warning' : 'info',
  color: true,
  
  // Error handling
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
