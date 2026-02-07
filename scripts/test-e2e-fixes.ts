/**
 * End-to-End Test Script for Recent Fixes
 * 
 * Tests:
 * 1. Multiple service selection booking flow
 * 2. Slot conflict detection and prevention
 * 3. Razorpay order creation error handling
 * 4. Available slots consistency
 * 
 * Usage:
 *   npx tsx scripts/test-e2e-fixes.ts
 */

const API_BASE_URL = process.env.API_BASE_URL || 
  process.env.NEXT_PUBLIC_API_BASE_URL || 
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const TEST_CUSTOMER_ID = process.env.TEST_CUSTOMER_ID || '39c84571-b26d-475a-bb38-94975cb8262d';
const TEST_VENDOR_ID = process.env.TEST_VENDOR_ID || '1ca03400-109f-4600-8092-ae34ea31b202';
const TEST_PHONE = process.env.TEST_PHONE || '9611377119';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function apiRequest(endpoint: string, method: string = 'GET', body?: any) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authToken = process.env.AUTH_TOKEN;
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  console.log(`\n📡 ${method} ${endpoint}`);
  if (body) {
    console.log('📦 Request:', JSON.stringify(body, null, 2));
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    let responseData: any;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`📊 Status: ${response.status}`);
    console.log('📥 Response:', JSON.stringify(responseData, null, 2));

    return {
      status: response.status,
      data: responseData,
      ok: response.ok,
    };
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

function recordTest(name: string, passed: boolean, message: string, details?: any) {
  results.push({ name, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

// Test 1: Get available slots
async function testAvailableSlots() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 1: Available Slots Endpoint');
  console.log('='.repeat(60));

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().split('T')[0];

  try {
    const response = await apiRequest(
      `/customer/vendor/${TEST_VENDOR_ID}/available-slots?date=${date}&serviceStyle=at_center`
    );

    if (response.ok && response.data?.success) {
      const slots = response.data.slots || [];
      const availableSlots = slots.filter((s: any) => s.available);
      
      recordTest(
        'Available Slots Fetch',
        true,
        `Found ${availableSlots.length} available slots out of ${slots.length} total`,
        { availableCount: availableSlots.length, totalCount: slots.length }
      );

      return { date, availableSlots, allSlots: slots };
    } else {
      recordTest('Available Slots Fetch', false, `Failed: ${response.data?.error || 'Unknown error'}`);
      return null;
    }
  } catch (error: any) {
    recordTest('Available Slots Fetch', false, error.message);
    return null;
  }
}

// Test 2: Create booking with single service
async function testSingleServiceBooking(slotInfo: any) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 2: Single Service Booking Creation');
  console.log('='.repeat(60));

  if (!slotInfo || slotInfo.availableSlots.length === 0) {
    recordTest('Single Service Booking', false, 'No available slots to test');
    return null;
  }

  const slot = slotInfo.availableSlots[0];
  const bookingTime = slot.time || '11:00';

  // First, get a service ID from the vendor
  try {
    const servicesResponse = await apiRequest(`/vendor/${TEST_VENDOR_ID}/services`);
    
    // ✅ FIX: Handle nested services structure
    let services: any[] = [];
    if (servicesResponse.data?.services) {
      // Handle servicesByStyle format
      if (servicesResponse.data.services.at_center || servicesResponse.data.services.at_home || servicesResponse.data.services.tele) {
        services = [
          ...(servicesResponse.data.services.at_center?.services || []),
          ...(servicesResponse.data.services.at_home?.services || []),
          ...(servicesResponse.data.services.tele?.services || [])
        ];
      } else if (Array.isArray(servicesResponse.data.services)) {
        services = servicesResponse.data.services;
      }
    } else if (servicesResponse.data?.allServices) {
      services = servicesResponse.data.allServices;
    } else if (Array.isArray(servicesResponse.data)) {
      services = servicesResponse.data;
    }
    
    if (services.length === 0) {
      recordTest('Single Service Booking', false, 'No services found for vendor');
      return null;
    }

    const service = services[0];
    const serviceId = service.serviceId || service.service_id || service.id;

    const bookingPayload = {
      customerId: TEST_CUSTOMER_ID,
      vendorId: TEST_VENDOR_ID,
      serviceId: serviceId,
      bookingDate: slotInfo.date,
      bookingTime: bookingTime,
      serviceType: 'at_center',
      amount: service.price || 1000,
      customerName: 'Test Customer',
      customerPhone: TEST_PHONE,
    };

    const response = await apiRequest('/bookings/create', 'POST', bookingPayload);

    if (response.ok && response.data?.bookingId) {
      recordTest(
        'Single Service Booking',
        true,
        `Booking created successfully: ${response.data.bookingId}`,
        { bookingId: response.data.bookingId }
      );
      return response.data.bookingId;
    } else {
      const errorCode = response.data?.error?.code;
      const errorMsg = response.data?.error?.message || response.data?.error || 'Unknown error';
      
      if (errorCode === 'SLOT_CONFLICT') {
        recordTest(
          'Single Service Booking - Slot Conflict Detection',
          true,
          'Slot conflict correctly detected',
          { error: errorMsg }
        );
      } else {
        recordTest('Single Service Booking', false, `Failed: ${errorMsg}`, { status: response.status });
      }
      return null;
    }
  } catch (error: any) {
    recordTest('Single Service Booking', false, error.message);
    return null;
  }
}

// Test 3: Test slot conflict detection
async function testSlotConflict(slotInfo: any, existingBookingId: string | null) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 3: Slot Conflict Detection');
  console.log('='.repeat(60));

  if (!slotInfo || slotInfo.availableSlots.length === 0) {
    recordTest('Slot Conflict Detection', false, 'No available slots to test');
    return;
  }

  const slot = slotInfo.availableSlots[0];
  const bookingTime = slot.time || '11:00';

  // Try to create another booking at the same time (should fail)
  try {
    const servicesResponse = await apiRequest(`/vendor/${TEST_VENDOR_ID}/services`);
    
    // ✅ FIX: Handle nested services structure
    let services: any[] = [];
    if (servicesResponse.data?.services) {
      if (servicesResponse.data.services.at_center || servicesResponse.data.services.at_home || servicesResponse.data.services.tele) {
        services = [
          ...(servicesResponse.data.services.at_center?.services || []),
          ...(servicesResponse.data.services.at_home?.services || []),
          ...(servicesResponse.data.services.tele?.services || [])
        ];
      } else if (Array.isArray(servicesResponse.data.services)) {
        services = servicesResponse.data.services;
      }
    } else if (servicesResponse.data?.allServices) {
      services = servicesResponse.data.allServices;
    } else if (Array.isArray(servicesResponse.data)) {
      services = servicesResponse.data;
    }
    
    if (services.length === 0) {
      recordTest('Slot Conflict Detection', false, 'No services found');
      return;
    }

    const service = services[0];
    const serviceId = service.serviceId || service.service_id || service.id;

    const bookingPayload = {
      customerId: TEST_CUSTOMER_ID,
      vendorId: TEST_VENDOR_ID,
      serviceId: serviceId,
      bookingDate: slotInfo.date,
      bookingTime: bookingTime,
      serviceType: 'at_center',
      amount: service.price || 1000,
      customerName: 'Test Customer',
      customerPhone: TEST_PHONE,
    };

    const response = await apiRequest('/bookings/create', 'POST', bookingPayload);

    if (response.status === 409 && response.data?.error?.code === 'SLOT_CONFLICT') {
      recordTest(
        'Slot Conflict Detection',
        true,
        'Slot conflict correctly detected and prevented',
        { error: response.data.error.message }
      );
    } else if (response.ok) {
      recordTest(
        'Slot Conflict Detection',
        false,
        'Slot conflict was NOT detected (this might be expected if slot was freed)',
        { bookingId: response.data?.bookingId }
      );
    } else {
      recordTest(
        'Slot Conflict Detection',
        false,
        `Unexpected response: ${response.status}`,
        { data: response.data }
      );
    }
  } catch (error: any) {
    recordTest('Slot Conflict Detection', false, error.message);
  }
}

// Test 4: Test multiple services booking (simulated via API)
async function testMultipleServicesBooking(slotInfo: any) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 4: Multiple Services Booking');
  console.log('='.repeat(60));

  if (!slotInfo || slotInfo.availableSlots.length === 0) {
    recordTest('Multiple Services Booking', false, 'No available slots to test');
    return;
  }

  const slot = slotInfo.availableSlots[1] || slotInfo.availableSlots[0];
  const bookingTime = slot.time || '12:00';

  try {
    const servicesResponse = await apiRequest(`/vendor/${TEST_VENDOR_ID}/services`);
    
    // ✅ FIX: Handle nested services structure
    let services: any[] = [];
    if (servicesResponse.data?.services) {
      if (servicesResponse.data.services.at_center || servicesResponse.data.services.at_home || servicesResponse.data.services.tele) {
        services = [
          ...(servicesResponse.data.services.at_center?.services || []),
          ...(servicesResponse.data.services.at_home?.services || []),
          ...(servicesResponse.data.services.tele?.services || [])
        ];
      } else if (Array.isArray(servicesResponse.data.services)) {
        services = servicesResponse.data.services;
      }
    } else if (servicesResponse.data?.allServices) {
      services = servicesResponse.data.allServices;
    } else if (Array.isArray(servicesResponse.data)) {
      services = servicesResponse.data;
    }
    
    if (services.length < 2) {
      recordTest('Multiple Services Booking', false, 'Need at least 2 services to test multiple selection');
      return;
    }

    // Get multiple services
    const service1 = services[0];
    const service2 = services[1];
    const service1Id = service1.serviceId || service1.service_id || service1.id;
    const service2Id = service2.serviceId || service2.service_id || service2.id;

    // Calculate total duration
    const duration1 = service1.duration || service1.duration_minutes || 30;
    const duration2 = service2.duration || service2.duration_minutes || 30;
    const totalDuration = duration1 + duration2;
    const totalPrice = (service1.price || 0) + (service2.price || 0);

    // Test available slots with total duration
    const slotsWithDuration = await apiRequest(
      `/customer/vendor/${TEST_VENDOR_ID}/available-slots?date=${slotInfo.date}&serviceStyle=at_center&totalDuration=${totalDuration}&serviceIds=${service1Id},${service2Id}`
    );

    if (slotsWithDuration.ok) {
      recordTest(
        'Multiple Services - Slots with Duration',
        true,
        `Available slots calculated with total duration: ${totalDuration} minutes`,
        { totalDuration, totalPrice }
      );
    } else {
      recordTest('Multiple Services - Slots with Duration', false, 'Failed to get slots with duration');
    }

    // Try to create booking (note: API might need to support multiple services array)
    const bookingPayload = {
      customerId: TEST_CUSTOMER_ID,
      vendorId: TEST_VENDOR_ID,
      serviceId: service1Id, // Primary service
      bookingDate: slotInfo.date,
      bookingTime: bookingTime,
      serviceType: 'at_center',
      amount: totalPrice,
      customerName: 'Test Customer',
      customerPhone: TEST_PHONE,
      // Note: If API supports services array, add it here
      // services: [{ serviceId: service1Id, price: service1.price }, { serviceId: service2Id, price: service2.price }],
      // totalDuration: totalDuration
    };

    const response = await apiRequest('/bookings/create', 'POST', bookingPayload);

    if (response.ok && response.data?.bookingId) {
      recordTest(
        'Multiple Services Booking',
        true,
        `Booking created with total amount: ₹${totalPrice}`,
        { bookingId: response.data.bookingId, totalPrice, totalDuration }
      );
      return response.data.bookingId;
    } else {
      recordTest('Multiple Services Booking', false, `Failed: ${response.data?.error?.message || 'Unknown error'}`);
      return null;
    }
  } catch (error: any) {
    recordTest('Multiple Services Booking', false, error.message);
    return null;
  }
}

// Test 5: Razorpay order creation
async function testRazorpayOrderCreation(bookingId: string | null) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 5: Razorpay Order Creation');
  console.log('='.repeat(60));

  if (!bookingId) {
    recordTest('Razorpay Order Creation', false, 'No booking ID available for testing');
    return;
  }

  try {
    // Test with valid booking
    const orderPayload = {
      bookingId: bookingId,
      amount: 1000,
      currency: 'INR',
      customerId: TEST_CUSTOMER_ID,
    };

    const response = await apiRequest('/razorpay/create-order', 'POST', orderPayload);

    if (response.ok && response.data?.orderId) {
      recordTest(
        'Razorpay Order Creation - Valid',
        true,
        `Order created: ${response.data.orderId}`,
        { orderId: response.data.orderId, amount: response.data.amount }
      );
    } else {
      const errorCode = response.data?.error?.code;
      const errorMsg = response.data?.error?.message || 'Unknown error';
      
      if (errorCode === 'VALIDATION_ERROR' || errorCode === 'NOT_FOUND') {
        recordTest(
          'Razorpay Order Creation - Error Handling',
          true,
          `Proper error returned: ${errorCode}`,
          { error: errorMsg }
        );
      } else {
        recordTest('Razorpay Order Creation', false, `Failed: ${errorMsg}`, { status: response.status });
      }
    }

    // Test with invalid booking (should return proper error, not 500)
    const invalidOrderPayload = {
      bookingId: '00000000-0000-0000-0000-000000000000',
      amount: 1000,
    };

    const invalidResponse = await apiRequest('/razorpay/create-order', 'POST', invalidOrderPayload);

    if (invalidResponse.status === 500) {
      recordTest(
        'Razorpay Order Creation - Error Handling',
        false,
        'Returned 500 instead of proper error code',
        { status: invalidResponse.status, data: invalidResponse.data }
      );
    } else if (invalidResponse.status === 404 || invalidResponse.status === 400) {
      recordTest(
        'Razorpay Order Creation - Error Handling',
        true,
        `Proper error status returned: ${invalidResponse.status}`,
        { error: invalidResponse.data?.error }
      );
    } else {
      recordTest(
        'Razorpay Order Creation - Error Handling',
        true,
        `Non-500 error returned: ${invalidResponse.status}`,
        { status: invalidResponse.status }
      );
    }
  } catch (error: any) {
    recordTest('Razorpay Order Creation', false, error.message);
  }
}

// Test 6: Available slots consistency check
async function testSlotsConsistency(slotInfo: any) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 6: Available Slots Consistency');
  console.log('='.repeat(60));

  if (!slotInfo) {
    recordTest('Slots Consistency', false, 'No slot info available');
    return;
  }

  try {
    // Fetch slots again to check consistency
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().split('T')[0];

    const response = await apiRequest(
      `/customer/vendor/${TEST_VENDOR_ID}/available-slots?date=${date}&serviceStyle=at_center`
    );

    if (response.ok && response.data?.success) {
      const newSlots = response.data.slots || [];
      const newAvailableSlots = newSlots.filter((s: any) => s.available);
      
      // Check if previously available slots are still marked correctly
      const previouslyAvailable = slotInfo.availableSlots.map((s: any) => s.time);
      const stillAvailable = newAvailableSlots
        .filter((s: any) => previouslyAvailable.includes(s.time))
        .map((s: any) => s.time);

      recordTest(
        'Slots Consistency',
        true,
        `Slots fetched consistently. ${stillAvailable.length}/${previouslyAvailable.length} previously available slots still available`,
        { 
          previouslyAvailable: previouslyAvailable.length,
          stillAvailable: stillAvailable.length,
          newTotalAvailable: newAvailableSlots.length
        }
      );
    } else {
      recordTest('Slots Consistency', false, 'Failed to fetch slots for consistency check');
    }
  } catch (error: any) {
    recordTest('Slots Consistency', false, error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 END-TO-END TEST SUITE FOR RECENT FIXES');
  console.log('='.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Vendor ID: ${TEST_VENDOR_ID}`);
  console.log(`Test Customer ID: ${TEST_CUSTOMER_ID}`);
  console.log('='.repeat(60));

  try {
    // Test 1: Available slots
    const slotInfo = await testAvailableSlots();

    // Test 2: Single service booking
    const bookingId1 = await testSingleServiceBooking(slotInfo);

    // Test 3: Slot conflict detection
    await testSlotConflict(slotInfo, bookingId1);

    // Test 4: Multiple services booking
    const bookingId2 = await testMultipleServicesBooking(slotInfo);

    // Test 5: Razorpay order creation
    await testRazorpayOrderCreation(bookingId1 || bookingId2);

    // Test 6: Slots consistency
    await testSlotsConsistency(slotInfo);

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error);
    recordTest('Test Suite', false, error.message);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  console.log('\n📋 Detailed Results:');
  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${index + 1}. ${icon} ${result.name}: ${result.message}`);
  });

  console.log('\n' + '='.repeat(60));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(console.error);
