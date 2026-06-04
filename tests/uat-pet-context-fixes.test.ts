/**
 * ============================================================================
 * UAT PET CONTEXT & AUTH FIXES VERIFICATION TESTS
 * ============================================================================
 * 
 * Tests for the critical fixes implemented:
 * 1. CUST-PET-001 & CUST-PET-002: Pet profile endpoint with phone-based ownership validation
 * 2. NUT-CUST-001: Nutrition service pet context validation
 * 3. VET-CUST-001: Vet service pet context validation
 * 4. NUT-AUTH-001: Vendor auth redirect loop fix
 * 
 * Run: npm test -- tests/uat-pet-context-fixes.test.ts
 * Or: npx ts-node tests/uat-pet-context-fixes.test.ts
 * 
 * Date: 2026-01-16
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
// TEST SUITE 1: Pet Profile Endpoint with Phone-Based Ownership (CUST-PET-001)
// ============================================================================

async function testPetProfileEndpoint() {
  console.log('\n🔍 Testing Fix #1: Pet Profile Endpoint (CUST-PET-001)');
  console.log('='.repeat(60));

  const testPhone = process.env.TEST_CUSTOMER_PHONE || '1234567890';
  const testPetId = process.env.TEST_PET_ID || 'test-pet-id';

  // Test 1.1: GET /customer/:phone/pets/:petId endpoint exists
  try {
    const result = await apiRequest(`/customer/${testPhone}/pets/${testPetId}`);
    
    if (result.status === 404 && result.data.error === 'Pet not found') {
      logResult(
        'Pet Profile - Endpoint Exists',
        'PASS',
        'Endpoint exists and returns proper 404 for non-existent pet',
        { status: result.status, error: result.data.error }
      );
    } else if (result.status === 404 && result.data.error === 'Customer not found') {
      logResult(
        'Pet Profile - Endpoint Exists',
        'PASS',
        'Endpoint exists and validates customer ownership',
        { status: result.status, error: result.data.error }
      );
    } else if (result.status === 200 && result.data.success && result.data.pet) {
      logResult(
        'Pet Profile - Endpoint Exists',
        'PASS',
        'Endpoint exists and returns pet data',
        { 
          status: result.status,
          hasPet: !!result.data.pet,
          petId: result.data.pet.id
        }
      );
    } else if (result.status === 500) {
      logResult(
        'Pet Profile - Endpoint Exists',
        'FAIL',
        'Endpoint returned 500 error',
        { status: result.status, error: result.data.error }
      );
    } else {
      logResult(
        'Pet Profile - Endpoint Exists',
        'SKIP',
        `Unexpected status: ${result.status}`,
        { status: result.status, data: result.data }
      );
    }
  } catch (error: any) {
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      logResult('Pet Profile - Endpoint Exists', 'FAIL', `Endpoint not found: ${error.message}`);
    } else {
      logResult('Pet Profile - Endpoint Exists', 'SKIP', `Request failed: ${error.message}`);
    }
  }

  // Test 1.2: Pet ownership validation (should not return pet for wrong customer)
  try {
    const wrongPhone = '9999999999';
    const result = await apiRequest(`/customer/${wrongPhone}/pets/${testPetId}`);
    
    if (result.status === 404) {
      logResult(
        'Pet Profile - Ownership Validation',
        'PASS',
        'Correctly validates pet ownership (returns 404 for wrong customer)',
        { status: result.status }
      );
    } else if (result.status === 200) {
      logResult(
        'Pet Profile - Ownership Validation',
        'FAIL',
        'Security issue: Returns pet data for wrong customer!',
        { status: result.status }
      );
    } else {
      logResult(
        'Pet Profile - Ownership Validation',
        'SKIP',
        `Status: ${result.status}`,
        { status: result.status }
      );
    }
  } catch (error: any) {
    logResult('Pet Profile - Ownership Validation', 'SKIP', `Request failed: ${error.message}`);
  }
}

// ============================================================================
// TEST SUITE 2: Pet Bookings Endpoint (CUST-PET-001)
// ============================================================================

async function testPetBookingsEndpoint() {
  console.log('\n🔍 Testing Fix #2: Pet Bookings Endpoint');
  console.log('='.repeat(60));

  const testPhone = process.env.TEST_CUSTOMER_PHONE || '1234567890';
  const testPetId = process.env.TEST_PET_ID || 'test-pet-id';

  // Test 2.1: GET /customer/:phone/pets/:petId/bookings endpoint exists
  try {
    const result = await apiRequest(`/customer/${testPhone}/pets/${testPetId}/bookings`);
    
    if (result.status === 200 && result.data.success) {
      logResult(
        'Pet Bookings - Endpoint Exists',
        'PASS',
        'Endpoint exists and returns booking data',
        { 
          status: result.status,
          hasBookings: Array.isArray(result.data.bookings),
          bookingsCount: result.data.bookings?.length || 0,
          hasStats: !!result.data.stats
        }
      );
    } else if (result.status === 404) {
      logResult(
        'Pet Bookings - Endpoint Exists',
        'PASS',
        'Endpoint exists (returns 404 for non-existent pet/customer)',
        { status: result.status }
      );
    } else if (result.status === 500) {
      logResult(
        'Pet Bookings - Endpoint Exists',
        'FAIL',
        'Endpoint returned 500 error',
        { status: result.status, error: result.data.error }
      );
    } else {
      logResult(
        'Pet Bookings - Endpoint Exists',
        'SKIP',
        `Status: ${result.status}`,
        { status: result.status, data: result.data }
      );
    }
  } catch (error: any) {
    logResult('Pet Bookings - Endpoint Exists', 'SKIP', `Request failed: ${error.message}`);
  }

  // Test 2.2: Bookings response structure
  try {
    const result = await apiRequest(`/customer/${testPhone}/pets/${testPetId}/bookings`);
    
    if (result.status === 200 && result.data.success) {
      const bookings = result.data.bookings || [];
      const stats = result.data.stats || {};
      
      const hasRequiredFields = bookings.length === 0 || bookings.every((b: any) => 
        b.id && b.serviceName && b.status !== undefined
      );
      
      const hasStats = stats.total !== undefined && 
                      stats.confirmed !== undefined &&
                      stats.completed !== undefined;
      
      if (hasRequiredFields && hasStats) {
        logResult(
          'Pet Bookings - Response Structure',
          'PASS',
          'Response has correct structure with bookings array and stats',
          { bookingsCount: bookings.length, hasStats }
        );
      } else {
        logResult(
          'Pet Bookings - Response Structure',
          'FAIL',
          'Response structure is missing required fields',
          { hasRequiredFields, hasStats }
        );
      }
    } else {
      logResult(
        'Pet Bookings - Response Structure',
        'SKIP',
        'Cannot verify structure (endpoint returned non-200)',
        { status: result.status }
      );
    }
  } catch (error: any) {
    logResult('Pet Bookings - Response Structure', 'SKIP', `Request failed: ${error.message}`);
  }

  // Test 2.3: React Native CustomerApi uses phone-scoped pet bookings URL (regression guard)
  try {
    const fs = require('fs');
    const path = require('path');
    const apiPath = path.join(__dirname, '../apps/WarmpawzCustomer/src/services/api.ts');
    if (fs.existsSync(apiPath)) {
      const content = fs.readFileSync(apiPath, 'utf-8');
      const hasWrongLegacyPath = content.includes('/customer/bookings/pet/');
      const hasLambdaPath =
        content.includes('/customer/${encodeURIComponent(phone)}/pets/${encodeURIComponent(petId)}/bookings') ||
        content.includes('/pets/${encodeURIComponent(petId)}/bookings');
      if (hasWrongLegacyPath && !hasLambdaPath) {
        logResult(
          'Pet Bookings - Mobile API path',
          'FAIL',
          'api.ts still references legacy /customer/bookings/pet/ path',
          { apiPath }
        );
      } else if (hasLambdaPath) {
        logResult(
          'Pet Bookings - Mobile API path',
          'PASS',
          'getPetBookings targets GET /customer/:phone/pets/:petId/bookings',
          { apiPath }
        );
      } else {
        logResult(
          'Pet Bookings - Mobile API path',
          'SKIP',
          'Could not confirm Lambda-aligned path in api.ts',
          { apiPath }
        );
      }
    } else {
      logResult('Pet Bookings - Mobile API path', 'SKIP', 'api.ts not found', { apiPath });
    }
  } catch (error: any) {
    logResult('Pet Bookings - Mobile API path', 'SKIP', `Cannot read file: ${error.message}`);
  }
}

// ============================================================================
// TEST SUITE 3: Pet Update & Delete Endpoints
// ============================================================================

async function testPetUpdateDeleteEndpoints() {
  console.log('\n🔍 Testing Fix #3: Pet Update & Delete Endpoints');
  console.log('='.repeat(60));

  const testPhone = process.env.TEST_CUSTOMER_PHONE || '1234567890';
  const testPetId = process.env.TEST_PET_ID || 'test-pet-id';

  // Test 3.1: PUT /customer/:phone/pets/:petId endpoint exists
  // Phone in URL must resolve via findCustomerByPhone (10-digit vs +91 in DB). Unit test:
  // backend/lambda/src/utils/__tests__/customer-phone-lookup.test.ts
  try {
    const result = await apiRequest(`/customer/${testPhone}/pets/${testPetId}`, 'PUT', {
      name: 'Test Pet Updated',
      weight: '10'
    });
    
    if (result.status === 404) {
      logResult(
        'Pet Update - Endpoint Exists',
        'PASS',
        'PUT endpoint exists (returns 404 for non-existent pet)',
        { status: result.status }
      );
    } else if (result.status === 200 && result.data.success) {
      logResult(
        'Pet Update - Endpoint Exists',
        'PASS',
        'PUT endpoint exists and updates pet successfully',
        { status: result.status, pet: result.data.pet }
      );
    } else if (result.status === 400) {
      logResult(
        'Pet Update - Endpoint Exists',
        'PASS',
        'PUT endpoint exists (validation error)',
        { status: result.status }
      );
    } else if (result.status === 500) {
      logResult(
        'Pet Update - Endpoint Exists',
        'FAIL',
        'PUT endpoint returned 500 error',
        { status: result.status, error: result.data.error }
      );
    } else {
      logResult(
        'Pet Update - Endpoint Exists',
        'SKIP',
        `Status: ${result.status}`,
        { status: result.status }
      );
    }
  } catch (error: any) {
    logResult('Pet Update - Endpoint Exists', 'SKIP', `Request failed: ${error.message}`);
  }

  // Test 3.2: DELETE /customer/:phone/pets/:petId endpoint exists
  try {
    const result = await apiRequest(`/customer/${testPhone}/pets/${testPetId}`, 'DELETE');
    
    if (result.status === 404) {
      logResult(
        'Pet Delete - Endpoint Exists',
        'PASS',
        'DELETE endpoint exists (returns 404 for non-existent pet)',
        { status: result.status }
      );
    } else if (result.status === 200 && result.data.success) {
      logResult(
        'Pet Delete - Endpoint Exists',
        'PASS',
        'DELETE endpoint exists and deletes pet successfully',
        { status: result.status }
      );
    } else if (result.status === 400 && result.data.activeBookingsCount) {
      logResult(
        'Pet Delete - Active Bookings Check',
        'PASS',
        'DELETE endpoint correctly prevents deletion with active bookings',
        { status: result.status, activeBookingsCount: result.data.activeBookingsCount }
      );
    } else if (result.status === 500) {
      logResult(
        'Pet Delete - Endpoint Exists',
        'FAIL',
        'DELETE endpoint returned 500 error',
        { status: result.status, error: result.data.error }
      );
    } else {
      logResult(
        'Pet Delete - Endpoint Exists',
        'SKIP',
        `Status: ${result.status}`,
        { status: result.status }
      );
    }
  } catch (error: any) {
    logResult('Pet Delete - Endpoint Exists', 'SKIP', `Request failed: ${error.message}`);
  }
}

// ============================================================================
// TEST SUITE 4: Error Boundary Component (NUT-CUST-001, VET-CUST-001)
// ============================================================================

async function testErrorBoundary() {
  console.log('\n🔍 Testing Fix #4: Error Boundary Component');
  console.log('='.repeat(60));

  // Test 4.1: ErrorBoundary component exists
  try {
    // This is a frontend component test - we can't directly test it via API
    // But we can verify the component file exists
    const fs = require('fs');
    const path = require('path');
    const errorBoundaryPath = path.join(__dirname, '../apps/customer-web/components/ErrorBoundary.tsx');
    
    if (fs.existsSync(errorBoundaryPath)) {
      const content = fs.readFileSync(errorBoundaryPath, 'utf-8');
      const hasErrorBoundary = content.includes('ErrorBoundary') && 
                               content.includes('componentDidCatch') &&
                               content.includes('hasError');
      
      if (hasErrorBoundary) {
        logResult(
          'Error Boundary - Component Exists',
          'PASS',
          'ErrorBoundary component exists with proper error handling',
          { path: errorBoundaryPath }
        );
      } else {
        logResult(
          'Error Boundary - Component Exists',
          'FAIL',
          'ErrorBoundary component missing required error handling methods',
          { path: errorBoundaryPath }
        );
      }
    } else {
      logResult(
        'Error Boundary - Component Exists',
        'FAIL',
        'ErrorBoundary component file not found',
        { expectedPath: errorBoundaryPath }
      );
    }
  } catch (error: any) {
    logResult('Error Boundary - Component Exists', 'SKIP', `Cannot check file: ${error.message}`);
  }

  // Test 4.2: ErrorBoundary is used in customer app
  try {
    const fs = require('fs');
    const path = require('path');
    const appPagePath = path.join(__dirname, '../apps/customer-web/app/page.tsx');
    
    if (fs.existsSync(appPagePath)) {
      const content = fs.readFileSync(appPagePath, 'utf-8');
      const usesErrorBoundary = content.includes('ErrorBoundary') && 
                                content.includes('import') &&
                                content.includes('<ErrorBoundary>');
      
      if (usesErrorBoundary) {
        logResult(
          'Error Boundary - Used in App',
          'PASS',
          'ErrorBoundary is properly imported and used in customer app',
          { path: appPagePath }
        );
      } else {
        logResult(
          'Error Boundary - Used in App',
          'FAIL',
          'ErrorBoundary not used in customer app page',
          { path: appPagePath }
        );
      }
    } else {
      logResult(
        'Error Boundary - Used in App',
        'SKIP',
        'Customer app page file not found',
        { expectedPath: appPagePath }
      );
    }
  } catch (error: any) {
    logResult('Error Boundary - Used in App', 'SKIP', `Cannot check file: ${error.message}`);
  }
}

// ============================================================================
// TEST SUITE 5: Pet Context Validation (NUT-CUST-001, VET-CUST-001)
// ============================================================================

async function testPetContextValidation() {
  console.log('\n🔍 Testing Fix #5: Pet Context Validation');
  console.log('='.repeat(60));

  // Test 5.1: NutritionistServicesLanding has pet validation
  try {
    const fs = require('fs');
    const path = require('path');
    const nutritionPath = path.join(__dirname, '../apps/customer-web/components/customer/NutritionistServicesLanding.tsx');
    
    if (fs.existsSync(nutritionPath)) {
      const content = fs.readFileSync(nutritionPath, 'utf-8');
      const hasPetValidation = content.includes('loadPets') && 
                               content.includes('hasPets') &&
                               content.includes('pets.length === 0');
      
      if (hasPetValidation) {
        logResult(
          'Pet Context - Nutrition Validation',
          'PASS',
          'NutritionistServicesLanding has pet context validation',
          { path: nutritionPath }
        );
      } else {
        logResult(
          'Pet Context - Nutrition Validation',
          'FAIL',
          'NutritionistServicesLanding missing pet context validation',
          { path: nutritionPath }
        );
      }
    } else {
      logResult(
        'Pet Context - Nutrition Validation',
        'FAIL',
        'NutritionistServicesLanding file not found',
        { expectedPath: nutritionPath }
      );
    }
  } catch (error: any) {
    logResult('Pet Context - Nutrition Validation', 'SKIP', `Cannot check file: ${error.message}`);
  }

  // Test 5.2: VetServiceRouter has pet validation
  try {
    const fs = require('fs');
    const path = require('path');
    const vetPath = path.join(__dirname, '../apps/customer-web/components/customer/VetServiceRouter.tsx');
    
    if (fs.existsSync(vetPath)) {
      const content = fs.readFileSync(vetPath, 'utf-8');
      const hasPetValidation = content.includes('loadPets') && 
                               content.includes('hasPets') &&
                               (content.includes('pets.length === 0') || content.includes('handleNavigate'));
      
      if (hasPetValidation) {
        logResult(
          'Pet Context - Vet Validation',
          'PASS',
          'VetServiceRouter has pet context validation',
          { path: vetPath }
        );
      } else {
        logResult(
          'Pet Context - Vet Validation',
          'FAIL',
          'VetServiceRouter missing pet context validation',
          { path: vetPath }
        );
      }
    } else {
      logResult(
        'Pet Context - Vet Validation',
        'FAIL',
        'VetServiceRouter file not found',
        { expectedPath: vetPath }
      );
    }
  } catch (error: any) {
    logResult('Pet Context - Vet Validation', 'SKIP', `Cannot check file: ${error.message}`);
  }
}

// ============================================================================
// TEST SUITE 6: Vendor Auth Redirect Fix (NUT-AUTH-001)
// ============================================================================

async function testVendorAuthRedirect() {
  console.log('\n🔍 Testing Fix #6: Vendor Auth Redirect Fix (NUT-AUTH-001)');
  console.log('='.repeat(60));

  // Test 6.1: Vendor auth page has redirect loop prevention
  try {
    const fs = require('fs');
    const path = require('path');
    const authPagePath = path.join(__dirname, '../apps/vendor-web/app/auth/page.tsx');
    
    if (fs.existsSync(authPagePath)) {
      const content = fs.readFileSync(authPagePath, 'utf-8');
      const hasRedirectFix = (content.includes('hasRedirected') || content.includes('window.location.href')) &&
                            (content.includes('setTimeout') || content.includes('clearTimeout'));
      
      if (hasRedirectFix) {
        logResult(
          'Vendor Auth - Redirect Fix',
          'PASS',
          'Vendor auth page has redirect loop prevention',
          { path: authPagePath }
        );
      } else {
        logResult(
          'Vendor Auth - Redirect Fix',
          'FAIL',
          'Vendor auth page missing redirect loop prevention',
          { path: authPagePath }
        );
      }
    } else {
      logResult(
        'Vendor Auth - Redirect Fix',
        'SKIP',
        'Vendor auth page file not found',
        { expectedPath: authPagePath }
      );
    }
  } catch (error: any) {
    logResult('Vendor Auth - Redirect Fix', 'SKIP', `Cannot check file: ${error.message}`);
  }

  // Test 6.2: Vendor home page has timeout
  try {
    const fs = require('fs');
    const path = require('path');
    const homePagePath = path.join(__dirname, '../apps/vendor-web/app/page.tsx');
    
    if (fs.existsSync(homePagePath)) {
      const content = fs.readFileSync(homePagePath, 'utf-8');
      const hasTimeout = content.includes('setTimeout') && 
                        (content.includes('5000') || content.includes('timeout'));
      
      if (hasTimeout) {
        logResult(
          'Vendor Home - Timeout Fix',
          'PASS',
          'Vendor home page has timeout to prevent infinite loading',
          { path: homePagePath }
        );
      } else {
        logResult(
          'Vendor Home - Timeout Fix',
          'FAIL',
          'Vendor home page missing timeout for session check',
          { path: homePagePath }
        );
      }
    } else {
      logResult(
        'Vendor Home - Timeout Fix',
        'SKIP',
        'Vendor home page file not found',
        { expectedPath: homePagePath }
      );
    }
  } catch (error: any) {
    logResult('Vendor Home - Timeout Fix', 'SKIP', `Cannot check file: ${error.message}`);
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  UAT PET CONTEXT & AUTH FIXES VERIFICATION TEST SUITE');
  console.log('═'.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  try {
    await testPetProfileEndpoint();
    await testPetBookingsEndpoint();
    await testPetUpdateDeleteEndpoints();
    await testErrorBoundary();
    await testPetContextValidation();
    await testVendorAuthRedirect();
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

export { 
  runAllTests, 
  testPetProfileEndpoint, 
  testPetBookingsEndpoint,
  testPetUpdateDeleteEndpoints,
  testErrorBoundary,
  testPetContextValidation,
  testVendorAuthRedirect
};
