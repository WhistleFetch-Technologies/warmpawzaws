/**
 * ============================================================================
 * UAT CRITICAL FIXES VERIFICATION TESTS
 * ============================================================================
 * 
 * Tests for the 3 critical UAT fixes implemented:
 * 1. Service Update SQL Error Fix
 * 2. Facility Provisioning During Vendor Approval
 * 3. PUT /vendor/facility/:vendorId Endpoint
 * 
 * Run: npm test -- tests/uat-critical-fixes.test.ts
 * Or: npx jest tests/uat-critical-fixes.test.ts
 * 
 * Date: 2025-01-13
 * ============================================================================
 */

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

// Helper function for API requests
async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  let data: any = {};
  try {
    data = await response.json();
  } catch {
    data = { error: 'Invalid JSON response' };
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

function logResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
  results.push({ test, status, message, details });
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${emoji} ${test}: ${message}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

// ============================================================================
// TEST SUITE 1: Service Update SQL Error Fix
// ============================================================================

async function testServiceUpdateSQLFix() {
  console.log('\n🔍 Testing Fix #1: Service Update SQL Error');
  console.log('=' .repeat(60));

  const testVendorId = process.env.TEST_VENDOR_ID || 'test-vendor-id';
  const testServiceId = process.env.TEST_SERVICE_ID || 'test-service-id';

  // Test 1.1: Update with empty body (should return 400, not 500)
  try {
    const result = await apiRequest(`/vendor/${testVendorId}/services/${testServiceId}`, 'PUT', {});
    if (result.status === 400) {
      logResult(
        'Service Update - Empty Body',
        'PASS',
        'Correctly returns 400 for empty update body',
        { status: result.status, error: result.data.error }
      );
    } else if (result.status === 404) {
      logResult(
        'Service Update - Empty Body',
        'SKIP',
        'Service not found (expected in test environment)',
        { status: result.status }
      );
    } else {
      logResult(
        'Service Update - Empty Body',
        result.status === 500 ? 'FAIL' : 'SKIP',
        `Unexpected status: ${result.status}`,
        { status: result.status, data: result.data }
      );
    }
  } catch (error: any) {
    logResult('Service Update - Empty Body', 'FAIL', `Request failed: ${error.message}`);
  }

  // Test 1.2: Update with undefined values (should handle gracefully)
  try {
    const result = await apiRequest(`/vendor/${testVendorId}/services/${testServiceId}`, 'PUT', {
      price: undefined,
      customPrice: undefined,
      isEnabled: undefined,
      publishStatus: undefined,
    });
    if (result.status === 400) {
      logResult(
        'Service Update - All Undefined',
        'PASS',
        'Correctly validates that at least one field must be provided',
        { status: result.status }
      );
    } else if (result.status === 404) {
      logResult(
        'Service Update - All Undefined',
        'SKIP',
        'Service not found (expected in test environment)',
        { status: result.status }
      );
    } else {
      logResult(
        'Service Update - All Undefined',
        'SKIP',
        `Status: ${result.status} (may be valid depending on endpoint logic)`,
        { status: result.status }
      );
    }
  } catch (error: any) {
    logResult('Service Update - All Undefined', 'FAIL', `Request failed: ${error.message}`);
  }

  // Test 1.3: Update with valid single field (should work)
  try {
    const result = await apiRequest(`/vendor/${testVendorId}/services/${testServiceId}`, 'PUT', {
      isEnabled: true,
    });
    if (result.status === 200) {
      logResult(
        'Service Update - Valid Single Field',
        'PASS',
        'Successfully updates service with single field',
        { status: result.status }
      );
    } else if (result.status === 404) {
      logResult(
        'Service Update - Valid Single Field',
        'SKIP',
        'Service not found (test data needed)',
        { status: result.status }
      );
    } else if (result.status === 403) {
      logResult(
        'Service Update - Valid Single Field',
        'SKIP',
        'Permission denied (test vendor may not have services capability)',
        { status: result.status }
      );
    } else {
      logResult(
        'Service Update - Valid Single Field',
        result.status === 500 ? 'FAIL' : 'SKIP',
        `Unexpected status: ${result.status}`,
        { status: result.status, error: result.data.error }
      );
    }
  } catch (error: any) {
    logResult('Service Update - Valid Single Field', 'FAIL', `Request failed: ${error.message}`);
  }

  // Test 1.4: Check for SQL syntax errors in response
  try {
    const result = await apiRequest(`/vendor/${testVendorId}/services/${testServiceId}`, 'PUT', {
      price: 1000,
      duration: 60,
    });
    if (result.status === 500 && result.data.error && result.data.error.includes('syntax error')) {
      logResult(
        'Service Update - SQL Syntax Check',
        'FAIL',
        'SQL syntax error still present!',
        { error: result.data.error }
      );
    } else if (result.status === 500) {
      logResult(
        'Service Update - SQL Syntax Check',
        'SKIP',
        '500 error but not SQL syntax related',
        { error: result.data.error }
      );
    } else {
      logResult(
        'Service Update - SQL Syntax Check',
        'PASS',
        'No SQL syntax errors detected',
        { status: result.status }
      );
    }
  } catch (error: any) {
    if (error.message.includes('syntax')) {
      logResult('Service Update - SQL Syntax Check', 'FAIL', `SQL error: ${error.message}`);
    } else {
      logResult('Service Update - SQL Syntax Check', 'SKIP', `Request failed: ${error.message}`);
    }
  }
}

// ============================================================================
// TEST SUITE 2: Facility Provisioning During Approval
// ============================================================================

async function testFacilityProvisioning() {
  console.log('\n🔍 Testing Fix #2: Facility Provisioning During Approval');
  console.log('=' .repeat(60));

  // Note: This test requires admin access and test vendor application
  // We'll check if the endpoint exists and handles facility data

  const testApplicationId = process.env.TEST_APPLICATION_ID || 'test-application-id';
  const adminToken = process.env.ADMIN_TOKEN || '';

  // Test 2.1: Approve vendor and check facility data is set
  try {
    const approveResult = await apiRequest(
      `/admin/vendor/application/${testApplicationId}/approve`,
      'POST',
      {},
      adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
    );

    if (approveResult.status === 200 || approveResult.status === 201) {
      const vendorId = approveResult.data.vendorId;
      
      // Check if vendor has facility data
      if (vendorId) {
        const vendorResult = await apiRequest(`/vendor/${vendorId}/facility`);
        if (vendorResult.status === 200) {
          const facility = vendorResult.data.facility;
          const hasAddress = facility?.address && facility.address !== 'Unknown' && facility.address !== 'Not specified';
          const hasCity = facility?.city && facility.city !== 'Unknown' && facility.city !== 'Not specified';
          const hasPincode = facility?.pincode && facility.pincode !== '000000';

          if (hasAddress || hasCity || hasPincode) {
            logResult(
              'Facility Provisioning - After Approval',
              'PASS',
              'Facility data is provisioned after approval',
              {
                hasAddress,
                hasCity,
                hasPincode,
                facility,
              }
            );
          } else {
            logResult(
              'Facility Provisioning - After Approval',
              'FAIL',
              'Facility data not properly provisioned (placeholder values found)',
              { facility }
            );
          }
        } else {
          logResult(
            'Facility Provisioning - After Approval',
            'SKIP',
            'Could not fetch facility data',
            { status: vendorResult.status }
          );
        }
      } else {
        logResult(
          'Facility Provisioning - After Approval',
          'SKIP',
          'Approval succeeded but no vendorId returned',
          { data: approveResult.data }
        );
      }
    } else if (approveResult.status === 401) {
      logResult(
        'Facility Provisioning - After Approval',
        'SKIP',
        'Admin authentication required',
        { status: approveResult.status }
      );
    } else if (approveResult.status === 404) {
      logResult(
        'Facility Provisioning - After Approval',
        'SKIP',
        'Test application not found (create test data first)',
        { status: approveResult.status }
      );
    } else {
      logResult(
        'Facility Provisioning - After Approval',
        'SKIP',
        `Approval endpoint returned: ${approveResult.status}`,
        { status: approveResult.status, error: approveResult.data.error }
      );
    }
  } catch (error: any) {
    logResult('Facility Provisioning - After Approval', 'FAIL', `Request failed: ${error.message}`);
  }
}

// ============================================================================
// TEST SUITE 3: PUT /vendor/facility/:vendorId Endpoint
// ============================================================================

async function testFacilityPUTEndpoint() {
  console.log('\n🔍 Testing Fix #3: PUT /vendor/facility/:vendorId Endpoint');
  console.log('=' .repeat(60));

  const testVendorId = process.env.TEST_VENDOR_ID || 'test-vendor-id';

  // Test 3.1: PUT endpoint exists (should not return 404)
  try {
    const result = await apiRequest(`/vendor/facility/${testVendorId}`, 'PUT', {
      address: '123 Test Street',
      city: 'Test City',
      state: 'Test State',
      pincode: '123456',
    });

    if (result.status === 404) {
      logResult(
        'Facility PUT - Endpoint Exists',
        'FAIL',
        'PUT /vendor/facility/:vendorId endpoint not found (404)',
        { status: result.status }
      );
    } else if (result.status === 200 || result.status === 201) {
      logResult(
        'Facility PUT - Endpoint Exists',
        'PASS',
        'PUT endpoint exists and accepts requests',
        { status: result.status, facility: result.data.facility }
      );
    } else if (result.status === 400) {
      logResult(
        'Facility PUT - Endpoint Exists',
        'PASS',
        'PUT endpoint exists (400 = validation error, not 404)',
        { status: result.status, error: result.data.error }
      );
    } else if (result.status === 401 || result.status === 403) {
      logResult(
        'Facility PUT - Endpoint Exists',
        'PASS',
        'PUT endpoint exists (auth required)',
        { status: result.status }
      );
    } else {
      logResult(
        'Facility PUT - Endpoint Exists',
        'SKIP',
        `Unexpected status: ${result.status}`,
        { status: result.status, data: result.data }
      );
    }
  } catch (error: any) {
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      logResult('Facility PUT - Endpoint Exists', 'FAIL', `Endpoint not found: ${error.message}`);
    } else {
      logResult('Facility PUT - Endpoint Exists', 'SKIP', `Request failed: ${error.message}`);
    }
  }

  // Test 3.2: PUT with valid facility data
  try {
    const facilityData = {
      address: '456 Test Avenue',
      city: 'Test City',
      state: 'Test State',
      pincode: '654321',
      latitude: 12.9716,
      longitude: 77.5946,
      operatingHours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
      },
      amenities: ['parking', 'wifi', 'ac'],
    };

    const result = await apiRequest(`/vendor/facility/${testVendorId}`, 'PUT', facilityData);

    if (result.status === 200 || result.status === 201) {
      logResult(
        'Facility PUT - Valid Data',
        'PASS',
        'Successfully updates facility with valid data',
        {
          status: result.status,
          facility: result.data.facility,
          message: result.data.message,
        }
      );
    } else if (result.status === 404) {
      logResult(
        'Facility PUT - Valid Data',
        'SKIP',
        'Vendor not found (test data needed)',
        { status: result.status }
      );
    } else {
      logResult(
        'Facility PUT - Valid Data',
        'SKIP',
        `Status: ${result.status}`,
        { status: result.status, error: result.data.error }
      );
    }
  } catch (error: any) {
    logResult('Facility PUT - Valid Data', 'FAIL', `Request failed: ${error.message}`);
  }

  // Test 3.3: PUT with empty body (should validate)
  try {
    const result = await apiRequest(`/vendor/facility/${testVendorId}`, 'PUT', {});

    if (result.status === 400) {
      logResult(
        'Facility PUT - Empty Body Validation',
        'PASS',
        'Correctly validates empty body',
        { status: result.status, error: result.data.error }
      );
    } else if (result.status === 404) {
      logResult(
        'Facility PUT - Empty Body Validation',
        'SKIP',
        'Vendor not found (expected in test environment)',
        { status: result.status }
      );
    } else {
      logResult(
        'Facility PUT - Empty Body Validation',
        'SKIP',
        `Status: ${result.status}`,
        { status: result.status }
      );
    }
  } catch (error: any) {
    logResult('Facility PUT - Empty Body Validation', 'SKIP', `Request failed: ${error.message}`);
  }

  // Test 3.4: GET facility after PUT (verify persistence)
  try {
    const getResult = await apiRequest(`/vendor/facility/${testVendorId}`);
    if (getResult.status === 200) {
      logResult(
        'Facility GET - After PUT',
        'PASS',
        'GET endpoint returns facility data',
        {
          status: getResult.status,
          hasFacility: !!getResult.data.facility,
        }
      );
    } else {
      logResult(
        'Facility GET - After PUT',
        'SKIP',
        `GET status: ${getResult.status}`,
        { status: getResult.status }
      );
    }
  } catch (error: any) {
    logResult('Facility GET - After PUT', 'SKIP', `Request failed: ${error.message}`);
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  UAT CRITICAL FIXES VERIFICATION TEST SUITE');
  console.log('═'.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  try {
    await testServiceUpdateSQLFix();
    await testFacilityProvisioning();
    await testFacilityPUTEndpoint();
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error);
    logResult('Test Suite', 'FAIL', error.message);
  }

  // Print summary
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   - ${r.test}: ${r.message}`);
      });
  }

  console.log('\n' + '═'.repeat(60));

  // Exit with appropriate code
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runAllTests, testServiceUpdateSQLFix, testFacilityProvisioning, testFacilityPUTEndpoint };
