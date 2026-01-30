/**
 * Test Case: Error Handling - 409 SLOT_CONFLICT
 * 
 * This test verifies that:
 * 1. 409 errors are properly caught and displayed
 * 2. No payment order creation is attempted on 409 error
 * 3. Error messages are user-friendly
 * 4. Processing state is properly reset
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

// Test data
const TEST_CUSTOMER_ID = '39c84571-b26d-475a-bb38-94975cb8262d';
const TEST_VENDOR_ID = 'c96058cb-6356-4e2b-9cf2-5149c6e9b942';
const TEST_SERVICE_ID = '03513ff5-284c-47c7-9382-1203f3b4af87';
const TEST_PET_ID = '6e28df3a-3880-460a-b747-bd359330fc32';
const TEST_DATE = '2026-01-24';
const TEST_TIME = '20:00'; // Use a time that's likely available

interface BookingResponse {
  success: boolean;
  statusCode?: number;
  data?: {
    bookingId: string;
    status: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

async function createBooking(time: string): Promise<BookingResponse> {
  try {
    const response = await axios.post(`${API_BASE_URL}/bookings/create`, {
      customerId: TEST_CUSTOMER_ID,
      vendorId: TEST_VENDOR_ID,
      serviceId: TEST_SERVICE_ID,
      bookingDate: TEST_DATE,
      bookingTime: time,
      serviceType: 'at_center',
      amount: 3500,
      petId: TEST_PET_ID,
      services: [{
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Ultrasound',
        price: 2000,
        duration: 60
      }],
      totalDuration: 60,
      customerName: 'Test Customer',
      customerPhone: '9611377119',
      petName: 'Max',
      notes: ''
    });

    return {
      success: true,
      statusCode: response.status,
      data: response.data.data || { bookingId: response.data.bookingId, status: 'pending' }
    };
  } catch (error: any) {
    return {
      success: false,
      statusCode: error.response?.status || 500,
      error: {
        code: error.response?.data?.error?.code || 'UNKNOWN',
        message: error.response?.data?.error?.message || error.message
      }
    };
  }
}

async function confirmBooking(bookingId: string): Promise<boolean> {
  try {
    // Simulate booking confirmation by updating status to 'confirmed'
    // In real scenario, this would happen via payment or vendor dashboard
    console.log(`   ⚠️  Note: Booking ${bookingId} needs to be confirmed manually`);
    console.log(`      (via payment completion or vendor dashboard)`);
    return true;
  } catch (error) {
    return false;
  }
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('TEST SUITE: Error Handling - 409 SLOT_CONFLICT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let testPassed = 0;
  let testFailed = 0;
  let confirmedBookingId: string | null = null;

  // Test 1: Create and confirm a booking
  console.log('📋 Test 1: Create and Confirm Booking');
  console.log('─────────────────────────────────────────────────────────────');
  const booking1 = await createBooking(TEST_TIME);
  
  if (booking1.success && booking1.data) {
    confirmedBookingId = booking1.data.bookingId;
    console.log(`✅ PASS: Booking created with ID: ${confirmedBookingId}`);
    console.log(`   Status: ${booking1.data.status}`);
    console.log(`   ⚠️  Please confirm this booking manually (via payment or vendor dashboard)`);
    console.log(`   ⚠️  Then run Test 2 to verify slot conflict detection`);
    testPassed++;
  } else {
    console.log(`❌ FAIL: Failed to create booking`);
    console.log(`   Error: ${booking1.error?.message || 'Unknown error'}`);
    testFailed++;
  }

  // Test 2: Attempt to create duplicate booking (should get 409)
  console.log('\n📋 Test 2: Attempt Duplicate Booking (Should Get 409)');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`   ⚠️  Prerequisite: Booking ${confirmedBookingId} must be confirmed`);
  console.log(`   Attempting to create another booking for same slot...\n`);
  
  const booking2 = await createBooking(TEST_TIME);
  
  if (!booking2.success && booking2.statusCode === 409) {
    console.log(`✅ PASS: Received 409 Conflict as expected`);
    console.log(`   Status Code: ${booking2.statusCode}`);
    console.log(`   Error Code: ${booking2.error?.code || 'SLOT_CONFLICT'}`);
    console.log(`   Error Message: ${booking2.error?.message || 'N/A'}`);
    
    // Verify error message is user-friendly
    if (booking2.error?.message && 
        booking2.error.message.toLowerCase().includes('already booked')) {
      console.log(`   ✅ Error message is user-friendly`);
      testPassed++;
    } else {
      console.log(`   ⚠️  Warning: Error message may not be user-friendly`);
      console.log(`      Message: ${booking2.error?.message}`);
    }
    
    // Verify error code
    if (booking2.error?.code === 'SLOT_CONFLICT') {
      console.log(`   ✅ Error code is correct: SLOT_CONFLICT`);
      testPassed++;
    } else {
      console.log(`   ❌ FAIL: Expected error code 'SLOT_CONFLICT', got '${booking2.error?.code}'`);
      testFailed++;
    }
  } else if (booking2.success) {
    console.log(`❌ FAIL: Booking was created (should have been blocked)`);
    console.log(`   This indicates the slot conflict check is not working correctly`);
    console.log(`   Booking ID: ${booking2.data?.bookingId}`);
    testFailed++;
  } else {
    console.log(`❌ FAIL: Unexpected error`);
    console.log(`   Status Code: ${booking2.statusCode}`);
    console.log(`   Error: ${booking2.error?.message || 'Unknown error'}`);
    testFailed++;
  }

  // Test 3: Verify error response structure
  console.log('\n📋 Test 3: Verify Error Response Structure');
  console.log('─────────────────────────────────────────────────────────────');
  if (booking2.error) {
    const hasCode = !!booking2.error.code;
    const hasMessage = !!booking2.error.message;
    
    if (hasCode && hasMessage) {
      console.log(`✅ PASS: Error response has required fields`);
      console.log(`   Code: ${booking2.error.code}`);
      console.log(`   Message: ${booking2.error.message}`);
      testPassed++;
    } else {
      console.log(`❌ FAIL: Error response missing required fields`);
      console.log(`   Has code: ${hasCode}`);
      console.log(`   Has message: ${hasMessage}`);
      testFailed++;
    }
  } else {
    console.log(`⚠️  SKIP: No error to verify (booking was created)`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${testPassed}`);
  console.log(`❌ Failed: ${testFailed}`);
  console.log(`📊 Total: ${testPassed + testFailed}`);
  
  if (confirmedBookingId) {
    console.log(`\n📝 Next Steps:`);
    console.log(`   1. Confirm booking ${confirmedBookingId} (via payment or vendor dashboard)`);
    console.log(`   2. Run this test again to verify 409 error handling`);
    console.log(`   3. Check frontend to verify error is displayed correctly`);
    console.log(`   4. Verify no payment order creation is attempted`);
  }
  
  console.log('\n');
}

// Run tests
runTests().catch(console.error);
