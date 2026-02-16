#!/usr/bin/env node
/**
 * Helper script to run multiple Next.js apps with proper environment variables
 * Usage: node scripts/run-all.js [dev|prod] [app1] [app2] [app3]
 * If no apps specified, runs all: admin-web, customer-web, vendor-web
 */
const { spawn } = require('child_process');
const path = require('path');

const mode = process.argv[2] || 'dev';
const apps = process.argv.slice(3);

const allApps = ['admin-web', 'customer-web', 'vendor-web'];
const appsToRun = apps.length > 0 ? apps : allApps;

// Validate mode
if (mode !== 'dev' && mode !== 'prod') {
  console.error(`❌ Error: Mode must be 'dev' or 'prod', got '${mode}'`);
  process.exit(1);
}

// Validate apps
const invalidApps = appsToRun.filter(app => !allApps.includes(app));
if (invalidApps.length > 0) {
  console.error(`❌ Error: Invalid app(s): ${invalidApps.join(', ')}`);
  console.error(`   Valid apps: ${allApps.join(', ')}`);
  process.exit(1);
}

const isProd = mode === 'prod';
const apiUrl = isProd 
  ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'
  : 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

console.log(`🚀 Starting apps in ${mode.toUpperCase()} mode:`);
console.log(`   Apps: ${appsToRun.join(', ')}`);
console.log(`   API Gateway: ${apiUrl}`);
console.log(`   Environment: ${isProd ? 'production' : 'development'}`);
console.log(`   UAT Mode: ${isProd ? 'disabled' : 'enabled'}`);
if (isProd) {
  console.log(`   ℹ️  Note: Running dev server with production configuration (NODE_ENV=development for dev server)`);
}
console.log('');

// Port mapping
const portMap = {
  'admin-web': '3003',
  'vendor-web': '3002',
  'customer-web': '3001',
};

// Spawn processes for each app
const processes = appsToRun.map(app => {
  const appPath = path.join(__dirname, '..', 'apps', app);
  const port = portMap[app];

  const env = {
    ...process.env,
    NEXT_PUBLIC_API_BASE_URL: apiUrl,
    NEXT_PUBLIC_ENVIRONMENT: isProd ? 'production' : 'development',
    NEXT_PUBLIC_UAT_MODE: isProd ? 'false' : 'true',
    // Keep NODE_ENV as 'development' for dev server to work correctly
    // NEXT_PUBLIC_ENVIRONMENT is used to indicate production mode
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  console.log(`📦 Starting ${app} on port ${port}...`);

  const child = spawn('npx', ['next', 'dev', '-p', port], {
    env,
    stdio: 'inherit',
    shell: true,
    cwd: appPath,
  });

  child.on('error', (error) => {
    console.error(`❌ Error starting ${app}:`, error);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ ${app} exited with code ${code}`);
    }
  });

  return { app, child };
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down all apps...');
  processes.forEach(({ app, child }) => {
    console.log(`   Stopping ${app}...`);
    child.kill('SIGINT');
  });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down all apps...');
  processes.forEach(({ app, child }) => {
    child.kill('SIGTERM');
  });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

console.log(`✅ All apps started. Press Ctrl+C to stop all apps.`);
console.log(`\n📱 Access URLs:`);
appsToRun.forEach(app => {
  const port = portMap[app];
  console.log(`   ${app}: http://localhost:${port}`);
});
