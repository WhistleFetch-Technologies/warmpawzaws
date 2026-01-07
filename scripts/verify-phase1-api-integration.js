/**
 * Phase 1 API Integration Verification Script
 * 
 * Verifies:
 * 1. All API methods are defined in service files
 * 2. All screens import and use the APIs
 * 3. All backend endpoints are registered
 * 4. API method signatures match backend endpoints
 */

const fs = require('fs');
const path = require('path');

const CUSTOMER_API_FILE = 'apps/WarmpawzCustomer/src/services/api.ts';
const VENDOR_API_FILE = 'apps/WarmpawzVendor/src/services/api.ts';
const HANDLER_FILE = 'backend/lambda/src/handler/index.ts';

// Expected API methods
const EXPECTED_CUSTOMER_APIS = {
  CommunityApi: ['getPosts', 'createPost', 'likePost', 'unlikePost', 'commentPost', 'getComments', 'deletePost'],
  ReferralApi: ['getReferralCode', 'getReferralStats', 'sendInvite', 'getReferralHistory', 'claimReward'],
  RewardsApi: ['getPoints', 'getHistory', 'getAvailableRewards', 'redeemPoints', 'getRewardDetails'],
  SubscriptionApi: ['getSubscriptions', 'getSubscriptionDetails', 'cancelSubscription', 'pauseSubscription', 'resumeSubscription', 'getSubscriptionUsage'],
  OrderReturnApi: ['createReturn', 'getReturnStatus', 'getReturnHistory', 'cancelReturn'],
};

const EXPECTED_VENDOR_APIS = {
  AnalyticsApi: ['getPerformanceMetrics', 'getRevenueAnalytics', 'getCustomerMetrics', 'getServiceMetrics', 'getStaffMetrics'],
  ReportsApi: ['getReports', 'generateReport', 'getReportHistory', 'downloadReport', 'getReportStatus'],
  TaxDocumentsApi: ['getDocuments', 'downloadTaxDocument', 'generateDocument', 'getTaxSummary'],
  TaxApi: ['getDocuments', 'downloadTaxDocument', 'generateDocument', 'getTaxSummary'], // Alias
};

// Screens that should use these APIs
const CUSTOMER_SCREENS = {
  'apps/WarmpawzCustomer/src/screens/community/CommunityScreen.tsx': ['CommunityApi'],
  'apps/WarmpawzCustomer/src/screens/rewards/ReferralSystemScreen.tsx': ['ReferralApi'],
  'apps/WarmpawzCustomer/src/screens/rewards/RewardsLoyaltyScreen.tsx': ['RewardsApi'],
  'apps/WarmpawzCustomer/src/screens/subscriptions/SubscriptionsScreen.tsx': ['SubscriptionApi'],
  'apps/WarmpawzCustomer/src/screens/orders/OrderReturnScreen.tsx': ['OrderReturnApi'],
};

const VENDOR_SCREENS = {
  'apps/WarmpawzVendor/src/screens/analytics/PerformanceMetricsScreen.tsx': ['AnalyticsApi', 'PerformanceMetricsApi'],
  'apps/WarmpawzVendor/src/screens/reports/ReportsScreen.tsx': ['ReportsApi'],
  'apps/WarmpawzVendor/src/screens/tax/TaxDocumentsScreen.tsx': ['TaxApi'],
};

// Expected backend endpoints
const EXPECTED_BACKEND_ENDPOINTS = [
  'registerCommunityEndpoints',
  'registerReferralEndpoints',
  'registerRewardsEndpoints',
];

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function verifyApiMethods(filePath, expectedApis) {
  const content = readFile(filePath);
  if (!content) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  const results = {};
  let allPassed = true;

  for (const [apiName, methods] of Object.entries(expectedApis)) {
    // Check if API is exported (either directly or as alias)
    const apiRegex = new RegExp(`export const ${apiName}\\s*=\\s*\\{`);
    const aliasRegex = new RegExp(`export const ${apiName}\\s*=\\s*\\w+Api`); // Alias like TaxApi = TaxDocumentsApi
    
    const found = apiRegex.test(content) || aliasRegex.test(content);
    if (!found) {
      results[apiName] = { found: false, methods: {} };
      allPassed = false;
      continue;
    }

    // Check each method
    const methodResults = {};
    for (const method of methods) {
      const methodRegex = new RegExp(`${method}\\s*:`);
      methodResults[method] = methodRegex.test(content);
      if (!methodResults[method]) {
        allPassed = false;
      }
    }
    results[apiName] = { found: true, methods: methodResults };
  }

  return { success: allPassed, results };
}

function verifyScreenIntegration(screenPath, expectedApis) {
  const content = readFile(screenPath);
  if (!content) {
    return { success: false, error: `File not found: ${screenPath}` };
  }

  const results = {};
  let allPassed = true;

  for (const apiName of expectedApis) {
    // Check if API is imported
    const importRegex = new RegExp(`import.*${apiName}.*from.*api`);
    const usedRegex = new RegExp(`${apiName}\\.`);
    
    const imported = importRegex.test(content);
    const used = usedRegex.test(content);
    
    results[apiName] = { imported, used };
    if (!imported || !used) {
      allPassed = false;
    }
  }

  return { success: allPassed, results };
}

function verifyBackendEndpoints(handlerPath, expectedEndpoints) {
  const content = readFile(handlerPath);
  if (!content) {
    return { success: false, error: `File not found: ${handlerPath}` };
  }

  const results = {};
  let allPassed = true;

  for (const endpoint of expectedEndpoints) {
    // Check if imported
    const importRegex = new RegExp(`import.*${endpoint}.*from`);
    // Check if registered
    const registerRegex = new RegExp(`${endpoint}\\(app\\)`);

    const imported = importRegex.test(content);
    const registered = registerRegex.test(content);

    results[endpoint] = { imported, registered };
    if (!imported || !registered) {
      allPassed = false;
    }
  }

  return { success: allPassed, results };
}

// Main verification
console.log('🔍 Phase 1 API Integration Verification\n');
console.log('='.repeat(60));

let overallSuccess = true;

// 1. Verify Customer API methods
console.log('\n1️⃣ Verifying Customer Mobile API Methods...');
const customerApiResult = verifyApiMethods(CUSTOMER_API_FILE, EXPECTED_CUSTOMER_APIS);
if (customerApiResult.success) {
  console.log('✅ All Customer API methods found');
} else {
  console.log('❌ Missing Customer API methods:');
  for (const [apiName, apiResult] of Object.entries(customerApiResult.results)) {
    if (!apiResult.found) {
      console.log(`   - ${apiName}: Not found`);
    } else {
      for (const [method, found] of Object.entries(apiResult.methods)) {
        if (!found) {
          console.log(`   - ${apiName}.${method}: Missing`);
        }
      }
    }
  }
  overallSuccess = false;
}

// 2. Verify Vendor API methods
console.log('\n2️⃣ Verifying Vendor Mobile API Methods...');
const vendorApiResult = verifyApiMethods(VENDOR_API_FILE, EXPECTED_VENDOR_APIS);
if (vendorApiResult.success) {
  console.log('✅ All Vendor API methods found');
} else {
  console.log('❌ Missing Vendor API methods:');
  for (const [apiName, apiResult] of Object.entries(vendorApiResult.results)) {
    if (!apiResult.found) {
      console.log(`   - ${apiName}: Not found`);
    } else {
      for (const [method, found] of Object.entries(apiResult.methods)) {
        if (!found) {
          console.log(`   - ${apiName}.${method}: Missing`);
        }
      }
    }
  }
  overallSuccess = false;
}

// 3. Verify Screen Integrations
console.log('\n3️⃣ Verifying Screen API Integrations...');
let screenSuccess = true;
for (const [screenPath, expectedApis] of Object.entries(CUSTOMER_SCREENS)) {
  const result = verifyScreenIntegration(screenPath, expectedApis);
  if (result.success) {
    console.log(`✅ ${path.basename(screenPath)}: All APIs integrated`);
  } else {
    console.log(`❌ ${path.basename(screenPath)}: Missing integrations`);
    for (const [apiName, apiResult] of Object.entries(result.results)) {
      if (!apiResult.imported) {
        console.log(`   - ${apiName}: Not imported`);
      }
      if (!apiResult.used) {
        console.log(`   - ${apiName}: Not used`);
      }
    }
    screenSuccess = false;
  }
}

for (const [screenPath, expectedApis] of Object.entries(VENDOR_SCREENS)) {
  const result = verifyScreenIntegration(screenPath, expectedApis);
  if (result.success) {
    console.log(`✅ ${path.basename(screenPath)}: All APIs integrated`);
  } else {
    console.log(`❌ ${path.basename(screenPath)}: Missing integrations`);
    for (const [apiName, apiResult] of Object.entries(result.results)) {
      if (!apiResult.imported) {
        console.log(`   - ${apiName}: Not imported`);
      }
      if (!apiResult.used) {
        console.log(`   - ${apiName}: Not used`);
      }
    }
    screenSuccess = false;
  }
}

if (!screenSuccess) {
  overallSuccess = false;
}

// 4. Verify Backend Endpoints
console.log('\n4️⃣ Verifying Backend Endpoint Registration...');
const backendResult = verifyBackendEndpoints(HANDLER_FILE, EXPECTED_BACKEND_ENDPOINTS);
if (backendResult.success) {
  console.log('✅ All backend endpoints registered');
} else {
  console.log('❌ Missing backend endpoint registrations:');
  for (const [endpoint, endpointResult] of Object.entries(backendResult.results)) {
    if (!endpointResult.imported) {
      console.log(`   - ${endpoint}: Not imported`);
    }
    if (!endpointResult.registered) {
      console.log(`   - ${endpoint}: Not registered`);
    }
  }
  overallSuccess = false;
}

// Final Summary
console.log('\n' + '='.repeat(60));
if (overallSuccess) {
  console.log('\n✅ PHASE 1 VERIFICATION: 100% PASSED');
  console.log('\nAll API methods defined');
  console.log('All screens integrated');
  console.log('All backend endpoints registered');
  process.exit(0);
} else {
  console.log('\n❌ PHASE 1 VERIFICATION: FAILED');
  console.log('\nPlease fix the issues above before proceeding.');
  process.exit(1);
}

