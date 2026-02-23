#!/usr/bin/env node
/**
 * Production build and start script for vendor-web
 * Builds with production settings (without static export) and starts the server locally
 */

process.env.NODE_ENV = 'production';
process.env.NEXT_PUBLIC_ENVIRONMENT = 'production';
process.env.NEXT_PUBLIC_API_BASE_URL = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
process.env.ENABLE_STATIC_EXPORT = 'false'; // Disable static export so we can run locally

console.log('🔧 Production build configuration (for local testing):');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   NEXT_PUBLIC_ENVIRONMENT:', process.env.NEXT_PUBLIC_ENVIRONMENT);
console.log('   NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL);
console.log('   ENABLE_STATIC_EXPORT:', process.env.ENABLE_STATIC_EXPORT, '(disabled for local server)');
console.log('');

// Run Next.js build
const { execSync, spawn } = require('child_process');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
process.chdir(appDir);

try {
  console.log('📦 Building with production settings...');
  execSync('next build', { 
    stdio: 'inherit',
    env: process.env 
  });
  console.log('');
  console.log('✅ Production build completed successfully!');
  console.log('');
  console.log('🚀 Starting production server on http://localhost:3002...');
  console.log('');
  
  // Start the server (next start reads distDir from next.config.js automatically)
  const server = spawn('npx', ['next', 'start', '-p', '3002'], {
    stdio: 'inherit',
    env: process.env,
    shell: true,
    cwd: appDir
  });
  
  server.on('error', (error) => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('');
    console.log('🛑 Shutting down server...');
    server.kill();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    server.kill();
    process.exit(0);
  });
  
} catch (error) {
  console.error('');
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
