#!/usr/bin/env node
/**
 * Helper script to run Next.js dev server with PRODUCTION environment variables
 */
const { spawn } = require('child_process');
const path = require('path');

const app = process.argv[2] || 'admin-web';
const apiUrl = process.argv[3] || 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';

console.log(`🚀 Starting ${app} with PROD API Gateway: ${apiUrl}`);
console.log(`⚠️  PRODUCTION MODE: UAT mode disabled, proper authentication required`);
console.log(`ℹ️  Note: Running dev server with production configuration (NODE_ENV=development for dev server)`);

const appPath = path.join(__dirname, '..', 'apps', app);

// Determine the port based on app
const portMap = {
  'admin-web': '3003',
  'vendor-web': '3002',
  'customer-web': '3001',
};
const port = portMap[app] || '3001';

const env = {
  ...process.env,
  NEXT_PUBLIC_API_BASE_URL: apiUrl,
  NEXT_PUBLIC_ENVIRONMENT: 'production',
  NEXT_PUBLIC_UAT_MODE: 'false',
  // Keep NODE_ENV as 'development' for dev server to work correctly
  // NEXT_PUBLIC_ENVIRONMENT is used to indicate production mode
  NODE_ENV: process.env.NODE_ENV || 'development',
};

console.log(`📦 Environment variables set:`);
console.log(`   NEXT_PUBLIC_API_BASE_URL=${env.NEXT_PUBLIC_API_BASE_URL}`);
console.log(`   NEXT_PUBLIC_ENVIRONMENT=${env.NEXT_PUBLIC_ENVIRONMENT}`);
console.log(`   NEXT_PUBLIC_UAT_MODE=${env.NEXT_PUBLIC_UAT_MODE}`);
console.log(`   NODE_ENV=${env.NODE_ENV}`);
console.log(`📦 Port: ${port}`);

// Call next dev directly instead of npm run dev to ensure env vars are passed
const child = spawn('npx', ['next', 'dev', '-p', port], {
  env,
  stdio: 'inherit',
  shell: true,
  cwd: appPath,
});

child.on('error', (error) => {
  console.error('Error:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
