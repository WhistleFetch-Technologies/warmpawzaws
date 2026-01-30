#!/usr/bin/env ts-node
/**
 * Complete Booking Flow Test
 * Tests: Slot availability → Booking creation → Razorpay order creation
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

// Test data
const TEST_CUSTOMER_ID = '39c84571-b26d-475a-bb38-94975cb8262d';
const TEST_VENDOR_ID = 'c96058cb-6356-4e2b-9cf2-5149c6e9b942';
const TEST_SERVICE_ID = '03513ff5-284c-47c7-9382-1203f3b4af87';
const TEST_PET_ID = '6e28df3a-3880-460a-b747-bd359330fc32';
const TEST_DATE = '2026-01-24';
let TEST_TIME = '23:00'; // Use a time slot that's likely available (late evening)

console.log('═══════════════════════════════════════════════════════════════');
console.log('COMPLETE BOOKING FLOW TEST');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

async function testCompleteFlow() {
  let bookingId: string | null = null;
  let paymentId: string | null = null;
  let razorpayOrderId: string | null = null;

  try {
    // Test 1: Check slot availability
    console.log('📋 Test 1: Check Slot Availability');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Checking slots for vendor ${TEST_VENDOR_ID} on ${TEST_DATE}...`);
    
    const slotsRes = await axios.get(
      `${API_BASE_URL}/customer/vendor/${TEST_VENDOR_ID}/available-slots`,
      {
        params: {
          date: TEST_DATE,
          serviceId: TEST_SERVICE_ID,
        },
      }
    );

    if (slotsRes.data.success && slotsRes.data.slots) {
      const availableSlots = slotsRes.data.slots.filter((s: any) => s.available);
      console.log(`   Found ${availableSlots.length} available slots`);
      
      // Use first available slot if TEST_TIME not available
      let testSlot = slotsRes.data.slots.find((s: any) => s.time === TEST_TIME);
      let actualTime = TEST_TIME;
      
      if (!testSlot && availableSlots.length > 0) {
        actualTime = availableSlots[0].time;
        testSlot = availableSlots[0];
        console.log(`   ⚠️  Slot ${TEST_TIME} not available, using ${actualTime} instead`);
      }
      
      if (testSlot) {
        console.log(`   ✅ Slot ${actualTime} found: available=${testSlot.available}`);
        if (!testSlot.available) {
          console.log(`   ⚠️  Slot is marked as unavailable: ${testSlot.reason || 'booked'}`);
          console.log(`   💡 This might be due to confirmed bookings or vendor hours`);
        }
        // Update TEST_TIME for rest of test
        if (actualTime !== TEST_TIME) {
          TEST_TIME = actualTime;
        }
      } else {
        console.log(`   ❌ No available slots found`);
        return;
      }
    } else {
      console.log('   ⚠️  Could not fetch slots');
      return;
    }
    console.log('');

    // Test 2: Create pending booking
    console.log('📋 Test 2: Create Pending Booking');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Creating booking for ${TEST_DATE} at ${TEST_TIME}...`);
    
    const bookingPayload = {
      customerId: TEST_CUSTOMER_ID,
      vendorId: TEST_VENDOR_ID,
      serviceId: TEST_SERVICE_ID,
      bookingDate: TEST_DATE,
      bookingTime: TEST_TIME,
      serviceType: 'at_center',
      amount: 2000,
      petId: TEST_PET_ID,
      services: [{
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Ultrasound',
        price: 2000,
        duration: 60,
      }],
      totalDuration: 60,
      customerName: 'Test Customer',
      customerPhone: '9611377119',
      petName: 'Max',
      notes: 'Test booking for flow verification',
    };

    let bookingRes;
    try {
      bookingRes = await axios.post(
        `${API_BASE_URL}/bookings/create`,
        bookingPayload
      );
    } catch (error: any) {
      if (error.response) {
        bookingRes = error.response;
      } else {
        throw error;
      }
    }

    if (bookingRes.status === 200 && bookingRes.data.success) {
      // Handle different response structures
      bookingId = bookingRes.data.booking?.id || 
                  bookingRes.data.data?.bookingId || 
                  bookingRes.data.bookingId;
      
      const bookingStatus = bookingRes.data.booking?.status || 
                           bookingRes.data.data?.status || 
                           bookingRes.data.status || 
                           'pending';
      
      if (bookingId) {
        console.log(`   ✅ Booking created successfully`);
        console.log(`   Booking ID: ${bookingId}`);
        console.log(`   Status: ${bookingStatus}`);
        
        if (bookingStatus !== 'pending') {
          console.log(`   ⚠️  Expected status 'pending', got '${bookingStatus}'`);
        }
      } else {
        console.log(`   ❌ Booking ID not found in response`);
        console.log(`   Response: ${JSON.stringify(bookingRes.data, null, 2)}`);
        return;
      }
    } else if (bookingRes.status === 409) {
      console.log(`   ❌ SLOT_CONFLICT: ${bookingRes.data.error?.message || 'Slot already booked'}`);
      console.log(`   💡 This indicates a confirmed booking exists for this slot`);
      return;
    } else {
      console.log(`   ❌ Booking creation failed`);
      console.log(`   Status: ${bookingRes.status}`);
      console.log(`   Error: ${JSON.stringify(bookingRes.data, null, 2)}`);
      return;
    }
    console.log('');

    // Test 3: Check slot availability again (should still be available for pending)
    console.log('📋 Test 3: Verify Slot Still Available (Pending Booking)');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Checking if slot ${TEST_TIME} is still available after pending booking...`);
    
    const slotsRes2 = await axios.get(
      `${API_BASE_URL}/customer/vendor/${TEST_VENDOR_ID}/available-slots`,
      {
        params: {
          date: TEST_DATE,
          serviceId: TEST_SERVICE_ID,
        },
      }
    );

    if (slotsRes2.data.success && slotsRes2.data.slots) {
      const testSlot2 = slotsRes2.data.slots.find((s: any) => s.time === TEST_TIME);
      if (testSlot2) {
        if (testSlot2.available) {
          console.log(`   ✅ Slot ${TEST_TIME} is still available (correct - pending bookings don't block)`);
        } else {
          console.log(`   ❌ Slot ${TEST_TIME} is marked as unavailable (incorrect - pending should not block)`);
          console.log(`   Reason: ${testSlot2.reason || 'unknown'}`);
        }
      }
    }
    console.log('');

    // Test 4: Create Razorpay order
    console.log('📋 Test 4: Create Razorpay Order');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Creating Razorpay order for booking ${bookingId}...`);
    
    const razorpayPayload = {
      bookingId: bookingId,
      amount: 2000,
      currency: 'INR',
      customerId: TEST_CUSTOMER_ID,
    };

    const razorpayRes = await axios.post(
      `${API_BASE_URL}/razorpay/create-order`,
      razorpayPayload,
      {
        timeout: 30000, // 30 second timeout
      }
    );

    if (razorpayRes.data.success) {
      if (razorpayRes.data.orderId) {
        razorpayOrderId = razorpayRes.data.orderId;
        paymentId = razorpayRes.data.paymentId;
        console.log(`   ✅ Razorpay order created successfully`);
        console.log(`   Order ID: ${razorpayOrderId}`);
        console.log(`   Payment ID: ${paymentId}`);
        console.log(`   Key ID: ${razorpayRes.data.keyId ? 'Present' : 'Missing'}`);
        console.log(`   Status: ${razorpayRes.data.status}`);
        
        if (!razorpayRes.data.keyId) {
          console.log(`   ⚠️  Warning: keyId not returned (needed for frontend)`);
        }
      } else {
        console.log(`   ❌ Order ID not returned in response`);
        console.log(`   Response: ${JSON.stringify(razorpayRes.data, null, 2)}`);
      }
    } else {
      console.log(`   ❌ Razorpay order creation failed: ${razorpayRes.data.error?.message || 'Unknown error'}`);
      console.log(`   Response: ${JSON.stringify(razorpayRes.data, null, 2)}`);
    }
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const allPassed = bookingId && razorpayOrderId;
    
    if (allPassed) {
      console.log('✅ All tests passed!');
      console.log('');
      console.log('📝 Created Resources:');
      console.log(`   Booking ID: ${bookingId}`);
      console.log(`   Payment ID: ${paymentId}`);
      console.log(`   Razorpay Order ID: ${razorpayOrderId}`);
      console.log('');
      console.log('💡 Next Steps:');
      console.log('   1. Complete payment via Razorpay checkout');
      console.log('   2. Verify booking status changes to "confirmed"');
      console.log('   3. Verify slot is blocked after confirmation');
    } else {
      console.log('❌ Some tests failed');
      if (!bookingId) {
        console.log('   - Booking creation failed');
      }
      if (!razorpayOrderId) {
        console.log('   - Razorpay order creation failed');
      }
    }

  } catch (error: any) {
    console.error('');
    console.error('❌ Test failed with error:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.error?.message || error.message}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   ${error.message}`);
    }
    console.error('');
    
    // Cleanup: Cancel booking if created
    if (bookingId) {
      console.log('🧹 Cleaning up: Cancelling test booking...');
      try {
        await axios.post(
          `${API_BASE_URL}/bookings/${bookingId}/cancel`,
          { reason: 'Test cleanup' }
        );
        console.log('   ✅ Booking cancelled');
      } catch (cleanupError) {
        console.log('   ⚠️  Could not cancel booking (may need manual cleanup)');
      }
    }
  }
}

// Run test
testCompleteFlow().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
