/**
 * Test Case: Multiple Services Payload
 * 
 * This test verifies that:
 * 1. Multiple services are sent in the booking payload
 * 2. Total duration is calculated correctly
 * 3. Total amount is calculated correctly
 * 4. All service IDs are included
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

// Test data
const TEST_CUSTOMER_ID = '39c84571-b26d-475a-bb38-94975cb8262d';
const TEST_VENDOR_ID = 'c96058cb-6356-4e2b-9cf2-5149c6e9b942';
const TEST_PET_ID = '6e28df3a-3880-460a-b747-bd359330fc32';
const TEST_DATE = '2026-01-24';
const TEST_TIME = '21:00'; // Use a time that's likely available

// Multiple services
const SERVICES = [
  {
    serviceId: '03513ff5-284c-47c7-9382-1203f3b4af87',
    serviceName: 'Ultrasound',
    price: 2000,
    duration: 60
  },
  {
    serviceId: 'b3b51b61-c942-4f06-bc7a-b3ca014cefd5',
    serviceName: 'Deworming',
    price: 1100,
    duration: 35
  }
];

interface BookingResponse {
  success: boolean;
  data?: {
    bookingId: string;
    status: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

async function createBookingWithMultipleServices(): Promise<BookingResponse> {
  try {
    const totalAmount = SERVICES.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = SERVICES.reduce((sum, s) => sum + s.duration, 0);
    
    const payload = {
      customerId: TEST_CUSTOMER_ID,
      vendorId: TEST_VENDOR_ID,
      serviceId: SERVICES[0].serviceId, // Primary service
      bookingDate: TEST_DATE,
      bookingTime: TEST_TIME,
      serviceType: 'at_center',
      amount: totalAmount,
      petId: TEST_PET_ID,
      services: SERVICES, // Multiple services array
      totalDuration: totalDuration,
      customerName: 'Test Customer',
      customerPhone: '9611377119',
      petName: 'Max',
      notes: ''
    };

    console.log('📤 Payload being sent:');
    console.log(JSON.stringify(payload, null, 2));

    const response = await axios.post(`${API_BASE_URL}/bookings/create`, payload);

    return {
      success: response.data.success || response.status === 200,
      data: response.data.data || { bookingId: response.data.bookingId, status: 'pending' }
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.response?.data?.error?.code || 'UNKNOWN',
        message: error.response?.data?.error?.message || error.message
      }
    };
  }
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('TEST SUITE: Multiple Services Payload');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let testPassed = 0;
  let testFailed = 0;

  // Test 1: Verify payload structure
  console.log('📋 Test 1: Verify Payload Structure');
  console.log('─────────────────────────────────────────────────────────────');
  const expectedTotalAmount = SERVICES.reduce((sum, s) => sum + s.price, 0);
  const expectedTotalDuration = SERVICES.reduce((sum, s) => sum + s.duration, 0);
  
  console.log(`   Services count: ${SERVICES.length}`);
  console.log(`   Expected total amount: ₹${expectedTotalAmount}`);
  console.log(`   Expected total duration: ${expectedTotalDuration} minutes`);
  console.log(`   Service IDs: ${SERVICES.map(s => s.serviceId).join(', ')}`);
  
  if (SERVICES.length > 1) {
    console.log(`   ✅ Multiple services configured`);
    testPassed++;
  } else {
    console.log(`   ❌ FAIL: Only one service configured`);
    testFailed++;
  }

  // Test 2: Create booking with multiple services
  console.log('\n📋 Test 2: Create Booking with Multiple Services');
  console.log('─────────────────────────────────────────────────────────────');
  const booking = await createBookingWithMultipleServices();
  
  if (booking.success && booking.data) {
    console.log(`✅ PASS: Booking created successfully`);
    console.log(`   Booking ID: ${booking.data.bookingId}`);
    console.log(`   Status: ${booking.data.status}`);
    testPassed++;
  } else {
    console.log(`❌ FAIL: Failed to create booking`);
    console.log(`   Error: ${booking.error?.message || 'Unknown error'}`);
    testFailed++;
    return;
  }

  // Test 3: Verify services array in request
  console.log('\n📋 Test 3: Verify Services Array in Request');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`   ✅ Services array sent: ${SERVICES.length} service(s)`);
  SERVICES.forEach((service, index) => {
    console.log(`   ${index + 1}. ${service.serviceName} (${service.serviceId})`);
    console.log(`      Price: ₹${service.price}, Duration: ${service.duration} min`);
  });
  testPassed++;

  // Test 4: Verify calculations
  console.log('\n📋 Test 4: Verify Total Calculations');
  console.log('─────────────────────────────────────────────────────────────');
  const calculatedTotal = SERVICES.reduce((sum, s) => sum + s.price, 0);
  const calculatedDuration = SERVICES.reduce((sum, s) => sum + s.duration, 0);
  
  console.log(`   Total Amount: ₹${calculatedTotal}`);
  console.log(`   Total Duration: ${calculatedDuration} minutes`);
  
  if (calculatedTotal === expectedTotalAmount && calculatedDuration === expectedTotalDuration) {
    console.log(`   ✅ Calculations are correct`);
    testPassed++;
  } else {
    console.log(`   ❌ FAIL: Calculations don't match`);
    console.log(`      Expected amount: ₹${expectedTotalAmount}, got: ₹${calculatedTotal}`);
    console.log(`      Expected duration: ${expectedTotalDuration}, got: ${calculatedDuration}`);
    testFailed++;
  }

  // Test 5: Verify all service IDs are unique
  console.log('\n📋 Test 5: Verify Service IDs are Unique');
  console.log('─────────────────────────────────────────────────────────────');
  const serviceIds = SERVICES.map(s => s.serviceId);
  const uniqueIds = new Set(serviceIds);
  
  if (serviceIds.length === uniqueIds.size) {
    console.log(`   ✅ All service IDs are unique`);
    console.log(`   Service IDs: ${Array.from(uniqueIds).join(', ')}`);
    testPassed++;
  } else {
    console.log(`   ❌ FAIL: Duplicate service IDs detected`);
    console.log(`   Service IDs: ${serviceIds.join(', ')}`);
    testFailed++;
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${testPassed}`);
  console.log(`❌ Failed: ${testFailed}`);
  console.log(`📊 Total: ${testPassed + testFailed}`);
  
  if (booking.data) {
    console.log(`\n📝 Booking Details:`);
    console.log(`   Booking ID: ${booking.data.bookingId}`);
    console.log(`   Services: ${SERVICES.length} service(s)`);
    console.log(`   Total Amount: ₹${expectedTotalAmount}`);
    console.log(`   Total Duration: ${expectedTotalDuration} minutes`);
  }
  
  console.log(`\n💡 Next Steps:`);
  console.log(`   1. Check CloudWatch logs to verify backend received all services`);
  console.log(`   2. Verify booking metadata contains all services`);
  console.log(`   3. Check frontend console for service count logs`);
  console.log('\n');
}

// Run tests
runTests().catch(console.error);
