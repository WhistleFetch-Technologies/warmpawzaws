/**
 * ============================================================================
 * ESBUILD CONFIGURATION FOR OPENSEARCH SYNC JOB
 * ============================================================================
 */

const esbuild = require('esbuild');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

esbuild.build({
  entryPoints: ['src/jobs/opensearch-sync.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/jobs/opensearch-sync.js',
  
  external: [
    '@aws-sdk/*',
    'aws-lambda',
    'pg-native',
  ],
  
  packages: 'bundle',
  format: 'cjs',
  sourcemap: !isProduction,
  minify: isProduction,
  
  nodePaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '../../node_modules'),
  ],
  
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
  },
  
  logLevel: isProduction ? 'warning' : 'info',
  color: true,
}).catch((error) => {
  console.error('Sync job build failed:', error);
  process.exit(1);
});
