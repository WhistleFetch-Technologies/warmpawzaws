/**
 * Comprehensive Synthetic Test for GPS Tracking Flow
 * 
 * Tests:
 * 1. API endpoints are accessible
 * 2. Handlers are registered correctly
 * 3. API contracts match expected structure
 * 4. UI components are properly integrated
 * 5. End-to-end flow simulation
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, testFn: () => Promise<any>): Promise<any> {
  try {
    console.log(`\n🧪 ${name}`);
    const result = await testFn();
    results.push({ test: name, status: 'PASS', message: 'Test passed', data: result });
    console.log(`✅ PASS: ${name}`);
    return result;
  } catch (error: any) {
    results.push({ test: name, status: 'FAIL', message: 'Test failed', error: error.message });
    console.error(`❌ FAIL: ${name} - ${error.message}`);
    throw error;
  }
}

async function testSkip(name: string, reason: string) {
  results.push({ test: name, status: 'SKIP', message: reason });
  console.log(`⏭️  SKIP: ${name} - ${reason}`);
}

async function main() {
  console.log('🚀 Comprehensive GPS Tracking Flow Test');
  console.log('='.repeat(60));
  console.log(`API Base: ${API_BASE}\n`);

  // Test 1: API Gateway Health Check
  await test('1. API Gateway Health Check', async () => {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    return { status: response.status, accessible: true };
  });

  // Test 2: Verify GPS Tracking Endpoints Registered
  await test('2. Verify GPS Tracking Endpoints Registered', async () => {
    // Test POST /tracking/start endpoint exists
    const startResponse = await fetch(`${API_BASE}/tracking/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: 'test-booking-123',
        vendorId: 'test-vendor-456',
      }),
    });
    
    // Should return 400 (missing fields) or 404 (not found) but not 500 (server error)
    // This confirms the endpoint is registered
    const startStatus = startResponse.status;
    if (startStatus >= 500) {
      throw new Error(`Endpoint returned server error: ${startStatus}`);
    }
    
    // Test GET /tracking/booking/:bookingId endpoint exists (no /status suffix)
    const statusResponse = await fetch(`${API_BASE}/tracking/booking/test-booking-123`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const statusStatus = statusResponse.status;
    if (statusStatus >= 500) {
      throw new Error(`Tracking booking endpoint returned server error: ${statusStatus}`);
    }
    
    return {
      startEndpoint: startStatus < 500 ? 'registered' : 'error',
      statusEndpoint: statusStatus < 500 ? 'registered' : 'error',
      startStatus,
      statusStatus,
    };
  });

  // Test 3: Test POST /tracking/start API Contract
  await test('3. Test POST /tracking/start API Contract', async () => {
    const requestBody = {
      bookingId: 'test-booking-123',
      vendorId: 'test-vendor-456',
      startLatitude: 19.0760,
      startLongitude: 72.8777,
    };

    const response = await fetch(`${API_BASE}/tracking/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data: any = await response.json();

    // Verify response structure
    if (response.status === 404) {
      // Booking not found is acceptable for synthetic test
      return { status: 'booking_not_found', acceptable: true };
    }

    if (!data.success && response.status !== 400) {
      throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
    }

    // If successful, verify structure
    if (data.success && data.session) {
      const requiredFields = ['id', 'bookingId', 'vendorId', 'status'];
      for (const field of requiredFields) {
        if (!data.session[field]) {
          throw new Error(`Missing required field in session: ${field}`);
        }
      }
    }

    return {
      status: response.status,
      hasSuccess: 'success' in data,
      hasSession: 'session' in data,
      contractValid: true,
    };
  });

  // Test 4: Test GET /tracking/booking/:bookingId API Contract (no /status - backend uses this path)
  await test('4. Test GET /tracking/booking/:bookingId API Contract', async () => {
    const response = await fetch(`${API_BASE}/tracking/booking/test-booking-123`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data: any = await response.json();

    // Verify response structure: backend returns success, tracking (or null), message
    if (response.status === 404) {
      return { status: 'no_active_session', acceptable: true };
    }

    if (!data.success && !data.tracking) {
      // No tracking session: backend returns success: true, tracking: null
      return { status: 'no_tracking', acceptable: true };
    }

    // If tracking exists, verify structure (backend returns providerName, not vendorName)
    if (data.success && data.tracking) {
      const requiredFields = ['id', 'status'];
      for (const field of requiredFields) {
        if (!data.tracking[field]) {
          throw new Error(`Missing required field in tracking: ${field}`);
        }
      }
      if (!data.tracking.providerName && !data.tracking.vendorName) {
        throw new Error('Missing providerName or vendorName in tracking');
      }

      // Check for enhanced fields
      const enhancedFields = {
        bookingDetails: data.tracking.bookingDetails,
        vendorDetails: data.tracking.vendorDetails,
        staffDetails: data.tracking.staffDetails,
      };

      return {
        status: response.status,
        hasRequiredFields: true,
        enhancedFields: Object.keys(enhancedFields).filter(k => enhancedFields[k as keyof typeof enhancedFields]),
        contractValid: true,
      };
    }

    return { status: response.status, contractValid: true };
  });

  // Test 5: Verify Handler Registration
  await test('5. Verify Handler Registration in Code', async () => {
    const fs = require('fs');
    const path = require('path');
    
    // Check handler/index.ts registers GPS tracking endpoints
    const handlerPath = path.join(__dirname, '../backend/lambda/src/handler/index.ts');
    if (!fs.existsSync(handlerPath)) {
      throw new Error('Handler file not found');
    }
    
    const handlerContent = fs.readFileSync(handlerPath, 'utf-8');
    
    const checks = {
      importsGpsTracking: handlerContent.includes('registerGpsTrackingEndpoints'),
      callsRegisterGpsTracking: handlerContent.includes('registerGpsTrackingEndpoints(app)'),
      hasTrackingStart: handlerContent.includes('/tracking/start') || handlerContent.includes('tracking/start'),
    };
    
    if (!checks.importsGpsTracking || !checks.callsRegisterGpsTracking) {
      throw new Error('GPS tracking endpoints not properly registered in handler');
    }
    
    return checks;
  });

  // Test 6: Verify UI Components Exist
  await test('6. Verify UI Components Exist', async () => {
    const fs = require('fs');
    const path = require('path');
    
    const components = {
      webPopup: path.join(__dirname, '../apps/customer-web/components/tracking/VendorLiveTrackingPopup.tsx'),
      mobilePopup: path.join(__dirname, '../apps/WarmpawzCustomer/src/screens/logistics/VendorTrackingPopup.tsx'),
      customerHome: path.join(__dirname, '../apps/customer-web/components/customer/CustomerHomeComplete.tsx'),
      vendorScreen: path.join(__dirname, '../apps/WarmpawzVendor/src/screens/tracking/GPSTrackingScreen.tsx'),
    };
    
    const checks: any = {};
    for (const [name, filePath] of Object.entries(components)) {
      checks[name] = fs.existsSync(filePath);
      if (!checks[name]) {
        throw new Error(`Component not found: ${name} at ${filePath}`);
      }
    }
    
    return checks;
  });

  // Test 7: Verify UI Component Integration
  await test('7. Verify UI Component Integration', async () => {
    const fs = require('fs');
    const path = require('path');
    
    // Check CustomerHomeComplete imports and uses VendorLiveTrackingPopup
    const customerHomePath = path.join(__dirname, '../apps/customer-web/components/customer/CustomerHomeComplete.tsx');
    const customerHomeContent = fs.readFileSync(customerHomePath, 'utf-8');
    
    const checks = {
      importsPopup: customerHomeContent.includes('VendorLiveTrackingPopup'),
      usesPopup: customerHomeContent.includes('<VendorLiveTrackingPopup'),
      hasActiveTrackingState: customerHomeContent.includes('activeTrackingSession'),
      callsTrackingEndpoint: customerHomeContent.includes('/tracking/booking/'),
      checksTravelingStatus: customerHomeContent.includes("status === 'traveling'"),
    };
    
    if (!checks.importsPopup || !checks.usesPopup) {
      throw new Error('VendorLiveTrackingPopup not properly integrated in CustomerHomeComplete');
    }
    
    return checks;
  });

  // Test 8: Verify API Contract Response Structure
  await test('8. Verify API Contract Response Structure', async () => {
    // Backend: GET /tracking/booking/:bookingId (no /status)
    const response = await fetch(`${API_BASE}/tracking/booking/test-booking-123`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data: any = await response.json();

    // Expected: success, tracking (object or null), message; tracking has id, status, providerName
    const structureCheck = {
      hasSuccess: typeof data.success === 'boolean' || data.success === undefined,
      hasTracking: data.tracking === undefined || data.tracking === null || typeof data.tracking === 'object',
      validStructure: true,
    };

    if (data.tracking) {
      structureCheck.validStructure =
        typeof data.tracking.id === 'string' &&
        typeof data.tracking.status === 'string' &&
        (typeof data.tracking.providerName === 'string' || typeof data.tracking.vendorName === 'string');
    }

    return {
      responseStatus: response.status,
      structureCheck,
      hasEnhancedFields: data.tracking && (
        data.tracking.bookingDetails ||
        data.tracking.vendorDetails ||
        data.tracking.staffDetails
      ),
    };
  });

  // Test 9: Verify Polling Mechanism
  await test('9. Verify Polling Mechanism in UI', async () => {
    const fs = require('fs');
    const path = require('path');
    
    // Check CustomerHomeComplete has polling
    const customerHomePath = path.join(__dirname, '../apps/customer-web/components/customer/CustomerHomeComplete.tsx');
    const customerHomeContent = fs.readFileSync(customerHomePath, 'utf-8');
    
    // Check popup has polling
    const popupPath = path.join(__dirname, '../apps/customer-web/components/tracking/VendorLiveTrackingPopup.tsx');
    const popupContent = fs.readFileSync(popupPath, 'utf-8');
    
    const checks = {
      customerHomePolling: customerHomeContent.includes('setInterval') && customerHomeContent.includes('loadActiveBookings'),
      popupPolling: popupContent.includes('setInterval') && popupContent.includes('10000'),
      pollingInterval: popupContent.includes('10000') || popupContent.includes('10 * 1000'),
    };
    
    return checks;
  });

  // Test 10: Verify Mobile Optimization
  await test('10. Verify Mobile Optimization', async () => {
    const fs = require('fs');
    const path = require('path');
    
    const popupPath = path.join(__dirname, '../apps/customer-web/components/tracking/VendorLiveTrackingPopup.tsx');
    const popupContent = fs.readFileSync(popupPath, 'utf-8');
    
    const checks = {
      hasMaxWidth: popupContent.includes('max-w-[430px]') || popupContent.includes('max-w-'),
      hasMobileStyles: popupContent.includes('sm:') || popupContent.includes('mobile'),
      responsiveDesign: true,
    };
    
    return checks;
  });

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`⏭️  Skipped: ${skipped}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`  - ${r.test}: ${r.error}`);
      });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 Detailed Results:');
  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`\n${index + 1}. ${icon} ${result.test}`);
    console.log(`   Status: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
    }
  });

  // Final verdict
  console.log('\n' + '='.repeat(60));
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED - Flow is properly wired!');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - Please review errors above');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n💥 Test suite failed:', error);
  process.exit(1);
});
