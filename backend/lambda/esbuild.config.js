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
        
        // Check if it's a directory (like ./common) - resolve to directory/index.js
        if (fs.existsSync(resolvedPath)) {
          const stats = fs.statSync(resolvedPath);
          if (stats.isDirectory()) {
            const indexPath = path.join(resolvedPath, 'index.js');
            if (fs.existsSync(indexPath)) {
              return { path: indexPath };
            }
          } else if (stats.isFile()) {
            // It's already a file, return it
            return { path: resolvedPath };
          }
        }
        
        // Try with .js extension if needed (like ./discovery -> ./discovery.js)
        const resolvedWithExt = resolvedPath.endsWith('.js') ? resolvedPath : resolvedPath + '.js';
        if (fs.existsSync(resolvedWithExt)) {
          return { path: resolvedWithExt };
        }
      }
      // Return undefined to let esbuild handle it with default resolution
      return undefined;
    });
  },
};

// Plugin to resolve custom TypeScript extensions like .booking.ts, .customer.ts, etc.
const customExtensionResolvePlugin = {
  name: 'custom-extension-resolve',
  setup(build) {
    // Handle imports that might have custom extensions like .booking, .customer, etc.
    build.onResolve({ filter: /.*/ }, (args) => {
      // If the path doesn't have an extension, try to resolve with custom extensions
      if (!args.path.includes('.') || args.path.endsWith('/')) {
        return undefined; // Let esbuild handle it
      }
      
      // Check if it's a relative import
      if (args.path.startsWith('.')) {
        const basePath = path.resolve(path.dirname(args.importer), args.path);
        
        // List of custom extensions to try
        const customExtensions = ['.booking', '.customer', '.razorpay', '.notification', '.teleCommunication', '.controller'];
        
        // First, try if the path already ends with a custom extension (like .customer)
        for (const ext of customExtensions) {
          if (args.path.endsWith(ext)) {
            const fullPath = basePath + '.ts';
            if (fs.existsSync(fullPath)) {
              return { path: fullPath };
            }
          }
        }
        
        // Then try adding custom extensions to the base path
        for (const ext of customExtensions) {
          const extTsPath = basePath + ext + '.ts';
          if (fs.existsSync(extTsPath)) {
            return { path: extTsPath };
          }
          
          const extPath = basePath + ext;
          if (fs.existsSync(extPath + '.ts')) {
            return { path: extPath + '.ts' };
          }
        }
      }
      
      return undefined; // Let esbuild handle default resolution
    });
  },
};

// Build API handler bundle
esbuild.build({
  entryPoints: ['src/handler/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/handler.js',
  plugins: [apiContractsResolvePlugin, customExtensionResolvePlugin],
  
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
  console.error('Build failed (api handler):', error);
  process.exit(1);
});

// Build Loyalty Events Consumer bundle
esbuild.build({
  entryPoints: ['src/Lambdas/loyalty-events-consumer.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/loyalty-consumer.js',
  plugins: [apiContractsResolvePlugin, customExtensionResolvePlugin],
  external: [
    '@aws-sdk/*',
    'aws-lambda',
    'pg-native',
    '@opensearch-project/opensearch',
    '@opensearch-project/opensearch/aws',
    'firebase-admin',
  ],
  packages: 'bundle',
  format: 'cjs',
  sourcemap: !isProduction,
  minify: isProduction,
  nodePaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '../../node_modules'),
    path.resolve(__dirname, '../../packages/api-contracts/dist'),
  ],
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
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
  },
  logLevel: isProduction ? 'warning' : 'info',
  color: true,
}).catch((error) => {
  console.error('Build failed (loyalty consumer):', error);
  process.exit(1);
});
