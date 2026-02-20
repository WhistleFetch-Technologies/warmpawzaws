#!/usr/bin/env node
/**
 * Start dev server with production API settings
 * Simply sets production environment variables and starts the dev server
 */

process.env.NEXT_PUBLIC_ENVIRONMENT = 'production';
process.env.NEXT_PUBLIC_API_BASE_URL = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';

console.log('🔧 Starting dev server with production settings:');
console.log('   NEXT_PUBLIC_ENVIRONMENT:', process.env.NEXT_PUBLIC_ENVIRONMENT);
console.log('   NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL);
console.log('');

// Start Next.js dev server
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const appDir = path.resolve(__dirname, '..');
process.chdir(appDir);

// Quick check for node_modules
if (!fs.existsSync(path.join(appDir, 'node_modules'))) {
  console.log('⚠️  node_modules not found. Installing dependencies...');
  console.log('');
  const { execSync } = require('child_process');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: appDir });
    console.log('');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

console.log('🚀 Starting dev server on http://localhost:3003...');
console.log('');

const server = spawn('npx', ['next', 'dev', '-p', '3003'], {
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
