#!/usr/bin/env node
/**
 * Production build script for vendor-web
 * Sets production environment variables and runs Next.js build
 */

process.env.NODE_ENV = 'production';
process.env.NEXT_PUBLIC_ENVIRONMENT = 'production';
process.env.NEXT_PUBLIC_API_BASE_URL = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
process.env.ENABLE_STATIC_EXPORT = 'true';

console.log('🔧 Production build configuration:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   NEXT_PUBLIC_ENVIRONMENT:', process.env.NEXT_PUBLIC_ENVIRONMENT);
console.log('   NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL);
console.log('   ENABLE_STATIC_EXPORT:', process.env.ENABLE_STATIC_EXPORT);
console.log('');

// Run Next.js build
const { execSync } = require('child_process');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
process.chdir(appDir);

try {
  execSync('next build', { 
    stdio: 'inherit',
    env: process.env 
  });
  console.log('');
  console.log('✅ Production build completed successfully!');
} catch (error) {
  console.error('');
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
