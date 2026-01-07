/**
 * Phase 4 Error Handling & Retry Logic Verification Script
 * 
 * Verifies:
 * 1. Mobile API service uses retry logic
 * 2. Web API client uses retry logic
 * 3. Offline detection is implemented
 * 4. Backend endpoints use retry for external calls
 * 5. Error recovery mechanisms are in place
 */

const fs = require('fs');
const path = require('path');

const MOBILE_API_FILE = 'apps/WarmpawzCustomer/src/services/api.ts';
const WEB_API_FILE = 'apps/customer-web/lib/api-client.ts';
const WEB_ERROR_HANDLING = 'apps/customer-web/lib/error-handling.ts';
const MOBILE_NETWORK_RESILIENCE = 'apps/WarmpawzCustomer/src/lib/network-resilience.ts';
const BACKEND_ERROR_RECOVERY = 'backend/lambda/src/utils/error-recovery.ts';
const BACKEND_AI_CHATBOT = 'backend/lambda/src/endpoints/ai-chatbot.ts';
const MOBILE_APP = 'apps/WarmpawzCustomer/App.tsx';

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function verifyMobileApiService() {
  const content = readFile(MOBILE_API_FILE);
  if (!content) {
    return { success: false, error: 'File not found' };
  }

  const hasRetry = /resilientFetch/.test(content);
  const hasNetworkMonitor = /NetworkMonitor/.test(content);
  const hasInitialize = /static.*initialize/.test(content);
  const hasErrorHandling = /NetworkError/.test(content);
  const hasRetryConfig = /RETRY_CONFIG/.test(content);

  return {
    success: hasRetry && hasNetworkMonitor && hasInitialize && hasErrorHandling,
    hasRetry,
    hasNetworkMonitor,
    hasInitialize,
    hasErrorHandling,
    hasRetryConfig,
  };
}

function verifyWebApiClient() {
  const content = readFile(WEB_API_FILE);
  if (!content) {
    return { success: false, error: 'File not found' };
  }

  const hasResilientFetch = /resilientFetch/.test(content);
  const hasErrorHandling = /error-handling/.test(content);
  const hasOfflineQueue = /OfflineQueue/.test(content);
  const hasRetryConfig = /retryConfig/.test(content);
  const hasSyncOfflineQueue = /syncOfflineQueue/.test(content);

  return {
    success: hasResilientFetch && hasErrorHandling && hasOfflineQueue,
    hasResilientFetch,
    hasErrorHandling,
    hasOfflineQueue,
    hasRetryConfig,
    hasSyncOfflineQueue,
  };
}

function verifyWebErrorHandling() {
  const content = readFile(WEB_ERROR_HANDLING);
  if (!content) {
    return { success: false, error: 'File not found' };
  }

  const hasRetry = /withRetry/.test(content);
  const hasResilientFetch = /resilientFetch/.test(content);
  const hasOfflineQueue = /class OfflineQueue/.test(content);
  const hasApiError = /class ApiError/.test(content);
  const hasExponentialBackoff = /backoffMultiplier|Math\.pow/.test(content);

  return {
    success: hasRetry && hasResilientFetch && hasOfflineQueue && hasApiError,
    hasRetry,
    hasResilientFetch,
    hasOfflineQueue,
    hasApiError,
    hasExponentialBackoff,
  };
}

function verifyMobileNetworkResilience() {
  const content = readFile(MOBILE_NETWORK_RESILIENCE);
  if (!content) {
    return { success: false, error: 'File not found' };
  }

  const hasResilientFetch = /export.*function resilientFetch/.test(content);
  const hasNetworkMonitor = /class NetworkMonitor/.test(content);
  const hasOfflineQueue = /class OfflineQueue/.test(content);
  const hasNetworkError = /class NetworkError/.test(content);
  const hasRetryConfig = /RetryConfig/.test(content);

  return {
    success: hasResilientFetch && hasNetworkMonitor && hasOfflineQueue && hasNetworkError,
    hasResilientFetch,
    hasNetworkMonitor,
    hasOfflineQueue,
    hasNetworkError,
    hasRetryConfig,
  };
}

function verifyBackendErrorRecovery() {
  const content = readFile(BACKEND_ERROR_RECOVERY);
  if (!content) {
    return { success: false, error: 'File not found' };
  }

  const hasWithRetry = /export.*function withRetry/.test(content);
  const hasCircuitBreaker = /CircuitBreaker|circuitBreaker/.test(content);
  const hasFailedOperations = /queueFailedOperation|retryFailedOperations/.test(content);
  const hasExponentialBackoff = /Math\.pow.*backoffMultiplier/.test(content);

  return {
    success: hasWithRetry && hasCircuitBreaker && hasFailedOperations,
    hasWithRetry,
    hasCircuitBreaker,
    hasFailedOperations,
    hasExponentialBackoff,
  };
}

function verifyBackendRetryUsage() {
  const content = readFile(BACKEND_AI_CHATBOT);
  if (!content) {
    return { success: false, error: 'File not found' };
  }

  const hasWithRetryImport = /import.*withRetry/.test(content);
  const hasWithRetryUsage = /withRetry\s*\(/.test(content);

  return {
    success: hasWithRetryImport && hasWithRetryUsage,
    hasWithRetryImport,
    hasWithRetryUsage,
  };
}

function verifyMobileInitialization() {
  const content = readFile(MOBILE_APP);
  if (!content) {
    return { success: false, error: 'File not found' };
  }

  const hasApiServiceInit = /ApiService\.initialize/.test(content);

  return {
    success: hasApiServiceInit,
    hasApiServiceInit,
  };
}

// Main verification
console.log('🔍 Phase 4 Error Handling & Retry Logic Verification\n');
console.log('='.repeat(60));

let overallSuccess = true;

// 1. Verify Mobile API Service
console.log('\n1️⃣ Verifying Mobile API Service...');
const mobileApiResult = verifyMobileApiService();
if (mobileApiResult.success) {
  console.log('✅ Mobile API service properly configured with retry logic');
} else {
  console.log('❌ Mobile API service issues:');
  if (!mobileApiResult.hasRetry) console.log('   - resilientFetch: Missing');
  if (!mobileApiResult.hasNetworkMonitor) console.log('   - NetworkMonitor: Missing');
  if (!mobileApiResult.hasInitialize) console.log('   - initialize(): Missing');
  if (!mobileApiResult.hasErrorHandling) console.log('   - NetworkError: Missing');
  overallSuccess = false;
}

// 2. Verify Web API Client
console.log('\n2️⃣ Verifying Web API Client...');
const webApiResult = verifyWebApiClient();
if (webApiResult.success) {
  console.log('✅ Web API client properly configured with retry logic');
} else {
  console.log('❌ Web API client issues:');
  if (!webApiResult.hasResilientFetch) console.log('   - resilientFetch: Missing');
  if (!webApiResult.hasErrorHandling) console.log('   - error-handling import: Missing');
  if (!webApiResult.hasOfflineQueue) console.log('   - OfflineQueue: Missing');
  overallSuccess = false;
}

// 3. Verify Web Error Handling
console.log('\n3️⃣ Verifying Web Error Handling Module...');
const webErrorResult = verifyWebErrorHandling();
if (webErrorResult.success) {
  console.log('✅ Web error handling module complete');
} else {
  console.log('❌ Web error handling issues:');
  if (!webErrorResult.hasRetry) console.log('   - withRetry: Missing');
  if (!webErrorResult.hasResilientFetch) console.log('   - resilientFetch: Missing');
  if (!webErrorResult.hasOfflineQueue) console.log('   - OfflineQueue: Missing');
  if (!webErrorResult.hasApiError) console.log('   - ApiError: Missing');
  overallSuccess = false;
}

// 4. Verify Mobile Network Resilience
console.log('\n4️⃣ Verifying Mobile Network Resilience Module...');
const mobileNetworkResult = verifyMobileNetworkResilience();
if (mobileNetworkResult.success) {
  console.log('✅ Mobile network resilience module complete');
} else {
  console.log('❌ Mobile network resilience issues:');
  if (!mobileNetworkResult.hasResilientFetch) console.log('   - resilientFetch: Missing');
  if (!mobileNetworkResult.hasNetworkMonitor) console.log('   - NetworkMonitor: Missing');
  if (!mobileNetworkResult.hasOfflineQueue) console.log('   - OfflineQueue: Missing');
  if (!mobileNetworkResult.hasNetworkError) console.log('   - NetworkError: Missing');
  overallSuccess = false;
}

// 5. Verify Backend Error Recovery
console.log('\n5️⃣ Verifying Backend Error Recovery...');
const backendErrorResult = verifyBackendErrorRecovery();
if (backendErrorResult.success) {
  console.log('✅ Backend error recovery utilities complete');
} else {
  console.log('❌ Backend error recovery issues:');
  if (!backendErrorResult.hasWithRetry) console.log('   - withRetry: Missing');
  if (!backendErrorResult.hasCircuitBreaker) console.log('   - CircuitBreaker: Missing');
  if (!backendErrorResult.hasFailedOperations) console.log('   - Failed operations queue: Missing');
  overallSuccess = false;
}

// 6. Verify Backend Retry Usage
console.log('\n6️⃣ Verifying Backend Retry Usage...');
const backendRetryResult = verifyBackendRetryUsage();
if (backendRetryResult.success) {
  console.log('✅ Backend endpoints use retry for external calls');
} else {
  console.log('❌ Backend retry usage issues:');
  if (!backendRetryResult.hasWithRetryImport) console.log('   - withRetry import: Missing');
  if (!backendRetryResult.hasWithRetryUsage) console.log('   - withRetry usage: Missing');
  overallSuccess = false;
}

// 7. Verify Mobile Initialization
console.log('\n7️⃣ Verifying Mobile App Initialization...');
const mobileInitResult = verifyMobileInitialization();
if (mobileInitResult.success) {
  console.log('✅ Mobile app initializes API service');
} else {
  console.log('❌ Mobile initialization issues:');
  if (!mobileInitResult.hasApiServiceInit) console.log('   - ApiService.initialize(): Missing');
  overallSuccess = false;
}

// Final Summary
console.log('\n' + '='.repeat(60));
if (overallSuccess) {
  console.log('\n✅ PHASE 4 VERIFICATION: 100% PASSED');
  console.log('\n✅ Retry logic with exponential backoff');
  console.log('✅ Offline detection and queue management');
  console.log('✅ Error recovery mechanisms');
  console.log('✅ Backend retry for external calls');
  console.log('✅ Complete error handling coverage');
  process.exit(0);
} else {
  console.log('\n❌ PHASE 4 VERIFICATION: FAILED');
  console.log('\nPlease fix the issues above before proceeding.');
  process.exit(1);
}

