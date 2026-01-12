#!/usr/bin/env node

/**
 * Local Sentry Testing Script
 * 
 * This script tests Sentry error tracking integration locally
 * without requiring a full Lambda deployment.
 * 
 * Usage:
 *   node scripts/test-sentry.js
 *   OR
 *   npm run test:sentry
 */

const path = require('path');

// Load environment variables from .env.local if it exists
try {
  // Try to load dotenv if available
  const dotenv = require('dotenv');
  const envPath = path.join(__dirname, '../../.env.local');
  const result = dotenv.config({ path: envPath });
  if (result.error && result.error.code !== 'ENOENT') {
    console.log('⚠️  Warning: Could not load .env.local:', result.error.message);
  } else if (!result.error) {
    console.log('✅ Loaded environment from .env.local\n');
  }
} catch (e) {
  // dotenv not available, try to read .env.local manually
  const fs = require('fs');
  const envPath = path.join(__dirname, '../../.env.local');
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          process.env[key.trim()] = value;
        }
      }
    });
    console.log('✅ Loaded environment from .env.local (manual parsing)\n');
  } catch (readError) {
    // .env.local doesn't exist or can't be read, that's okay
  }
}

// Set test environment variables if not already set
if (!process.env.SENTRY_DSN) {
  console.log('⚠️  SENTRY_DSN not found in environment');
  console.log('📝 Please add to .env.local:');
  console.log('   SENTRY_DSN=https://your-dsn@sentry.io/project-id');
  console.log('   ENABLE_ERROR_TRACKING=true\n');
  process.exit(1);
}

if (!process.env.ENABLE_ERROR_TRACKING) {
  process.env.ENABLE_ERROR_TRACKING = 'true';
}

console.log('🧪 Testing Sentry Error Tracking Integration\n');
console.log('📋 Configuration:');
console.log(`   DSN: ${process.env.SENTRY_DSN.substring(0, 30)}...`);
console.log(`   Enabled: ${process.env.ENABLE_ERROR_TRACKING}\n`);

// Import error tracking utilities
const {
  initializeErrorTracking,
  captureException,
  captureMessage,
  setUserContext,
  addBreadcrumb,
  getErrorTrackingConfig,
} = require('../src/utils/error-tracking');

// Initialize Sentry
console.log('🔧 Initializing error tracking...');
const config = getErrorTrackingConfig();
initializeErrorTracking(config);
console.log('✅ Error tracking initialized\n');

// Test 1: Capture a simple error
console.log('📤 Test 1: Capturing simple error...');
try {
  throw new Error('Test error from local script');
} catch (error) {
  captureException(error, {
    test: true,
    source: 'local-test-script',
    timestamp: new Date().toISOString(),
  });
  console.log('✅ Error captured (check Sentry dashboard)\n');
}

// Test 2: Capture a message
console.log('📤 Test 2: Capturing test message...');
captureMessage('Test message from local script', {
  level: 'info',
  test: true,
  source: 'local-test-script',
});
console.log('✅ Message captured (check Sentry dashboard)\n');

// Test 3: Set user context
console.log('📤 Test 3: Setting user context...');
setUserContext('test-user-123', 'admin', {
  email: 'test@warmpawz.com',
  test: true,
});
console.log('✅ User context set\n');

// Test 4: Add breadcrumbs
console.log('📤 Test 4: Adding breadcrumbs...');
addBreadcrumb({
  message: 'User clicked button',
  category: 'ui',
  level: 'info',
});
addBreadcrumb({
  message: 'API request started',
  category: 'http',
  level: 'info',
  data: {
    url: '/test/endpoint',
    method: 'GET',
  },
});
console.log('✅ Breadcrumbs added\n');

// Test 5: Capture error with context
console.log('📤 Test 5: Capturing error with full context...');
try {
  throw new TypeError('Test type error with context');
} catch (error) {
  captureException(error, {
    test: true,
    source: 'local-test-script',
    context: {
      requestId: 'test-request-123',
      path: '/test/endpoint',
      method: 'GET',
      userId: 'test-user-123',
    },
    tags: {
      environment: 'local',
      test: 'true',
    },
  });
  console.log('✅ Error with context captured\n');
}

// Test 6: Simulate API error
console.log('📤 Test 6: Simulating API error...');
try {
  // Simulate an API call that fails
  const apiError = new Error('API request failed');
  apiError.statusCode = 500;
  apiError.name = 'APIError';
  throw apiError;
} catch (error) {
  captureException(error, {
    test: true,
    source: 'local-test-script',
    apiError: true,
    endpoint: '/api/test',
    statusCode: error.statusCode,
  });
  console.log('✅ API error captured\n');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ All tests completed!\n');
console.log('📊 Next steps:');
console.log('   1. Go to https://sentry.io');
console.log('   2. Navigate to your project');
console.log('   3. Check "Issues" tab');
console.log('   4. You should see 6 test events\n');
console.log('⏱️  Note: Events may take 10-30 seconds to appear\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Give Sentry time to send events
setTimeout(() => {
  console.log('✨ Test script completed. Check Sentry dashboard for results.\n');
  process.exit(0);
}, 2000);
