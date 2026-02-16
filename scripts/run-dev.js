#!/usr/bin/env node
/**
 * Helper script to run Next.js dev server with proper environment variable
 */
const { spawn } = require('child_process');
const path = require('path');

const app = process.argv[2] || 'admin-web';
const apiUrl = process.argv[3] || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

console.log(`🚀 Starting ${app} with DEV API Gateway: ${apiUrl}`);

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
  NODE_ENV: process.env.NODE_ENV || 'development',
};

console.log(`📦 Environment variable set: NEXT_PUBLIC_API_BASE_URL=${env.NEXT_PUBLIC_API_BASE_URL}`);
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
