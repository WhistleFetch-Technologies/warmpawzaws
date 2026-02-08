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
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';

// Plugin to resolve relative requires in api-contracts dist files
const apiContractsResolvePlugin = {
  name: 'api-contracts-resolve',
  setup(build) {
    const apiContractsDist = path.resolve(__dirname, '../../packages/api-contracts/dist');
    
    // Resolve relative requires in api-contracts dist files
    build.onResolve({ filter: /^\.\/.*$/ }, (args) => {
      // If we're resolving from an api-contracts dist file
      if (args.importer && args.importer.includes('api-contracts/dist')) {
        const resolvedPath = path.resolve(path.dirname(args.importer), args.path);
        // Try with .js extension if needed
        const resolvedWithExt = resolvedPath.endsWith('.js') ? resolvedPath : resolvedPath + '.js';
        
        // Check if the file exists
        if (fs.existsSync(resolvedPath)) {
          return { path: resolvedPath };
        } else if (fs.existsSync(resolvedWithExt)) {
          return { path: resolvedWithExt };
        }
      }
      // Return undefined to let esbuild handle it with default resolution
      return undefined;
    });
  },
};

esbuild.build({
  entryPoints: ['src/handler/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/handler.js',
  plugins: [apiContractsResolvePlugin],
  
  // External dependencies (AWS SDK, native modules)
  // These are provided by Lambda runtime or must be excluded due to native bindings
  external: [
    '@aws-sdk/*',     // Provided by Lambda runtime
    'aws-lambda',     // Provided by Lambda runtime
    'pg-native',      // Native PostgreSQL module (we use pure JS pg instead)
    '@opensearch-project/opensearch',
    '@opensearch-project/opensearch/aws',
    'firebase-admin', // Not used in Lambda, exclude to reduce bundle size
    // ✅ FIX: These MUST be bundled for Lambda to work:
    // - 'pg' - PostgreSQL driver (removed from external)
    // - 'jose' - JWT handling (removed from external)
    // - 'zod' - Schema validation (removed from external)
    // - 'hono' - HTTP framework (already bundled)
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
    path.resolve(__dirname, '../../packages/api-contracts/dist'), // Allow esbuild to resolve relative requires in api-contracts
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
    '@warmpawz/api-contracts/discovery': path.resolve(__dirname, '../../packages/api-contracts/dist/discovery.js'),
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
