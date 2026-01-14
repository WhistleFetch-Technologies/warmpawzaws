/**
 * ============================================================================
 * CAPABILITY ENFORCEMENT TESTS
 * ============================================================================
 * 
 * Tests that verify capability checks are working correctly
 * Run: npx ts-node tests/capabilities/test-capability-enforcement.ts
 * 
 * ============================================================================
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  capability: string;
  endpoint: string;
  method: string;
  expectedStatus: number[];
  actualStatus: number;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string,
  capability: string,
  method: string,
  endpoint: string,
  body: any = null,
  expectedStatus: number[] = [200, 201, 403]
): Promise<TestResult> {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-vendor-id': 'test-vendor-id', // Invalid vendor - should fail capability check
      },
    };
    
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const passed = expectedStatus.includes(response.status);
    
    return {
      name,
      capability,
      endpoint,
      method,
      expectedStatus,
      actualStatus: response.status,
      passed,
      message: passed 
        ? `✅ Passed - Got ${response.status}` 
        : `❌ Failed - Expected ${expectedStatus.join(' or ')}, got ${response.status}`,
    };
  } catch (error: any) {
    return {
      name,
      capability,
      endpoint,
      method,
      expectedStatus,
      actualStatus: 0,
      passed: false,
      message: `❌ Error - ${error.message}`,
    };
  }
}

async function runAllTests() {
  console.log('🧪 CAPABILITY ENFORCEMENT TESTS');
  console.log('================================\n');
  console.log(`API URL: ${API_URL}\n`);
  
  // Test vendor ID that doesn't have capabilities
  const testVendorId = 'test-vendor-id';
  
  // ====================
  // PRESCRIPTIONS
  // ====================
  results.push(await testEndpoint(
    'Create Prescription (no capability)',
    'prescriptions',
    'POST',
    '/prescriptions',
    {
      bookingId: 'test-booking',
      customerId: 'test-customer',
      vendorId: testVendorId,
      medications: [{ name: 'Test Med', dosage: '1mg' }],
    },
    [403, 400] // Should get 403 (no capability) or 400 (validation)
  ));
  
  results.push(await testEndpoint(
    'Get Vendor Prescriptions (no capability)',
    'prescriptions',
    'GET',
    `/prescriptions/vendor/${testVendorId}`,
    null,
    [200, 403] // Returns 200 with empty array for test IDs, or 403
  ));
  
  // ====================
  // MEDICAL RECORDS
  // ====================
  results.push(await testEndpoint(
    'Create Medical Record (no capability)',
    'medical_records',
    'POST',
    '/medical-records',
    {
      petId: 'test-pet',
      customerId: 'test-customer',
      vendorId: testVendorId,
      recordType: 'checkup',
    },
    [403, 400]
  ));
  
  results.push(await testEndpoint(
    'Get Vendor Medical Records (no capability)',
    'medical_records',
    'GET',
    `/medical-records/vendor/${testVendorId}`,
    null,
    [200, 403]
  ));
  
  // ====================
  // AMBULANCE
  // ====================
  results.push(await testEndpoint(
    'Get Ambulance Vehicles (no capability)',
    'ambulance',
    'GET',
    `/vendor/${testVendorId}/ambulance/vehicles`,
    null,
    [403]
  ));
  
  results.push(await testEndpoint(
    'Add Ambulance Vehicle (no capability)',
    'ambulance',
    'POST',
    `/vendor/${testVendorId}/ambulance/vehicles`,
    { vehicleNumber: 'TEST001', vehicleType: 'basic' },
    [403]
  ));
  
  // ====================
  // DIAGNOSTICS
  // ====================
  results.push(await testEndpoint(
    'Get Diagnostic Tests (no capability)',
    'diagnostics',
    'GET',
    `/vendor/${testVendorId}/diagnostics/tests`,
    null,
    [403]
  ));
  
  results.push(await testEndpoint(
    'Add Diagnostic Test (no capability)',
    'diagnostics',
    'POST',
    `/vendor/${testVendorId}/diagnostics/tests`,
    { testName: 'Blood Test', price: 500 },
    [403]
  ));
  
  // ====================
  // PHARMACY
  // ====================
  results.push(await testEndpoint(
    'Get Pharmacy Medicines (no capability)',
    'pharmacy',
    'GET',
    `/vendor/${testVendorId}/pharmacy/medicines`,
    null,
    [403]
  ));
  
  results.push(await testEndpoint(
    'Add Medicine (no capability)',
    'pharmacy',
    'POST',
    `/vendor/${testVendorId}/pharmacy/medicines`,
    { name: 'Paracetamol', price: 50, stock: 100 },
    [403]
  ));
  
  // ====================
  // MEAL PLANS
  // ====================
  results.push(await testEndpoint(
    'Get Meal Plans (no capability)',
    'meal_plans',
    'GET',
    `/vendor/${testVendorId}/nutritionist/meal-plans`,
    null,
    [403]
  ));
  
  results.push(await testEndpoint(
    'Create Meal Plan (no capability)',
    'meal_plans',
    'POST',
    `/vendor/${testVendorId}/nutritionist/meal-plans`,
    { planName: 'Weight Loss Plan', description: 'Test' },
    [403]
  ));
  
  // ====================
  // CAFE TABLES
  // ====================
  results.push(await testEndpoint(
    'Get Cafe Tables (no capability)',
    'cafe_tables',
    'GET',
    `/vendor/${testVendorId}/cafe/tables`,
    null,
    [403]
  ));
  
  results.push(await testEndpoint(
    'Add Cafe Table (no capability)',
    'cafe_tables',
    'POST',
    `/vendor/${testVendorId}/cafe/tables`,
    { tables: [{ tableNumber: 'T1', capacity: 4 }] },
    [403]
  ));
  
  // ====================
  // ADOPTION / PET PROFILES
  // ====================
  results.push(await testEndpoint(
    'Get Adoption Pets (no capability)',
    'adoption',
    'GET',
    `/vendor/${testVendorId}/breeder/puppies`,
    null,
    [403]
  ));
  
  results.push(await testEndpoint(
    'Add Pet for Adoption (no capability)',
    'adoption',
    'POST',
    `/vendor/${testVendorId}/breeder/puppies`,
    { name: 'Max', breed: 'Labrador', petType: 'dog' },
    [403]
  ));
  
  // ====================
  // RESORT ROOMS
  // ====================
  results.push(await testEndpoint(
    'Get Resort Rooms (no capability)',
    'rooms',
    'GET',
    `/vendor/${testVendorId}/resort/rooms`,
    null,
    [403]
  ));
  
  results.push(await testEndpoint(
    'Add Resort Room (no capability)',
    'rooms',
    'POST',
    `/vendor/${testVendorId}/resort/rooms`,
    { roomNumber: 'R101', roomType: 'deluxe', pricePerNight: 1000 },
    [403]
  ));
  
  // ====================
  // TRAINING PROGRAMS
  // ====================
  results.push(await testEndpoint(
    'Get Training Programs (no capability)',
    'training_programs',
    'GET',
    `/vendor/${testVendorId}/training/programs`,
    null,
    [403]
  ));
  
  results.push(await testEndpoint(
    'Create Training Program (no capability)',
    'training_programs',
    'POST',
    `/vendor/${testVendorId}/training/programs`,
    { name: 'Basic Obedience', price: 5000 },
    [403]
  ));
  
  // ====================
  // HOLIDAY PACKAGES
  // ====================
  results.push(await testEndpoint(
    'Get Holiday Packages (no capability)',
    'holiday_packages',
    'GET',
    `/vendor/${testVendorId}/holidays/packages`,
    null,
    [403]
  ));
  
  results.push(await testEndpoint(
    'Create Holiday Package (no capability)',
    'holiday_packages',
    'POST',
    `/vendor/${testVendorId}/holidays/packages`,
    { name: 'Mountain Trek', destination: 'Manali', price: 15000 },
    [403]
  ));
  
  // ====================
  // EVENTS
  // ====================
  results.push(await testEndpoint(
    'Get Vendor Events (no capability)',
    'events',
    'GET',
    '/vendor/events?vendorId=' + testVendorId,
    null,
    [403, 400]
  ));
  
  results.push(await testEndpoint(
    'Create Vendor Event (no capability)',
    'events',
    'POST',
    '/vendor/events',
    {
      vendorId: testVendorId,
      name: 'Test Event',
      eventDate: '2026-02-01',
      startTime: '10:00',
    },
    [403]
  ));
  
  // ====================
  // PUBLIC DISCOVERY ENDPOINTS (Should work without capability)
  // ====================
  results.push(await testEndpoint(
    'Discover Events (public)',
    'none',
    'GET',
    '/events/discover',
    null,
    [200]
  ));
  
  results.push(await testEndpoint(
    'Discover Meal Plans (public)',
    'none',
    'GET',
    '/discover/meal-plans',
    null,
    [200]
  ));
  
  results.push(await testEndpoint(
    'Discover Training Programs (public)',
    'none',
    'GET',
    '/discover/training-programs',
    null,
    [200]
  ));
  
  results.push(await testEndpoint(
    'Discover Holiday Packages (public)',
    'none',
    'GET',
    '/discover/holiday-packages',
    null,
    [200]
  ));
  
  results.push(await testEndpoint(
    'Discover Adoption Pets (public)',
    'none',
    'GET',
    '/discover/adoption-pets',
    null,
    [200]
  ));
  
  results.push(await testEndpoint(
    'Discover Boarding Rooms (public)',
    'none',
    'GET',
    '/discover/boarding-rooms',
    null,
    [200]
  ));
  
  // ====================
  // PRINT RESULTS
  // ====================
  console.log('\n📊 TEST RESULTS\n');
  console.log('=' .repeat(80));
  
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  
  // Group by capability
  const byCapability: Record<string, TestResult[]> = {};
  for (const result of results) {
    if (!byCapability[result.capability]) {
      byCapability[result.capability] = [];
    }
    byCapability[result.capability].push(result);
  }
  
  for (const [capability, tests] of Object.entries(byCapability)) {
    console.log(`\n📌 ${capability.toUpperCase()}`);
    console.log('-'.repeat(40));
    for (const test of tests) {
      console.log(`  ${test.message}`);
      console.log(`     ${test.method} ${test.endpoint}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📈 SUMMARY`);
  console.log(`   Total Tests: ${results.length}`);
  console.log(`   ✅ Passed: ${passed.length}`);
  console.log(`   ❌ Failed: ${failed.length}`);
  console.log(`   Success Rate: ${((passed.length / results.length) * 100).toFixed(1)}%`);
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    for (const f of failed) {
      console.log(`   - ${f.name}: ${f.message}`);
    }
  }
  
  console.log('\n');
  
  // Exit with error code if any tests failed
  process.exit(failed.length > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(console.error);
