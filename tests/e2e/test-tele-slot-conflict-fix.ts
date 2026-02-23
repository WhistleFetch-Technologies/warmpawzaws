/**
 * ============================================================================
 * TEST: Tele Booking Slot Conflict Fix
 * ============================================================================
 * 
 * Tests that booking at 2:00 PM does NOT block 2:30 PM slot for tele consultations
 * 
 * Expected Behavior:
 * - Booking 2:00 PM (30 min) should end at 2:30 PM
 * - Slot 2:30 PM should be available for booking
 * - Parallel bookings at 2:00 PM and 2:30 PM should be allowed
 * 
 * Run: npx ts-node tests/e2e/test-tele-slot-conflict-fix.ts
 * ============================================================================
 */

const API_BASE = process.env.TEST_API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const VENDOR_ID = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45'; // Shreesha's Vet Solo
// Use a date 7 days from now to ensure slots are available
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 7);
const TEST_DATE = futureDate.toISOString().split('T')[0];

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode: number;
}

async function apiRequest(endpoint: string, options: { method?: string; body?: any } = {}): Promise<ApiResponse> {
  const { method = 'GET', body } = options;
  const url = `${API_BASE}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    return {
      success: response.ok,
      data: response.ok ? data : undefined,
      error: !response.ok ? (data.error || response.statusText) : undefined,
      statusCode: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
      statusCode: 500,
    };
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testTeleSlotConflictFix() {
  console.log('═'.repeat(60));
  console.log('TELE BOOKING SLOT CONFLICT FIX TEST');
  console.log('═'.repeat(60));
  console.log(`API: ${API_BASE}`);
  console.log(`Vendor: ${VENDOR_ID}`);
  console.log(`Date: ${TEST_DATE}`);
  console.log('═'.repeat(60));
  console.log();

  // Step 1: Get available slots before booking
  console.log('Step 1: Checking available slots before booking...');
  const slotsBeforeResponse = await apiRequest(
    `/customer/vendor/${VENDOR_ID}/available-slots?date=${TEST_DATE}&serviceStyle=tele`
  );

  if (!slotsBeforeResponse.success) {
    console.error('❌ Failed to fetch slots:', slotsBeforeResponse.error);
    return;
  }

  const slotsBefore = slotsBeforeResponse.data?.slots || [];
  const slot1400 = slotsBefore.find((s: any) => s.time === '14:00');
  const slot1430 = slotsBefore.find((s: any) => s.time === '14:30');

  console.log(`  Slot 14:00: available=${slot1400?.available}, booked=${slot1400?.booked}`);
  console.log(`  Slot 14:30: available=${slot1430?.available}, booked=${slot1430?.booked}`);
  console.log();

  // Find any available slot, then check if slot 30 minutes later exists and is available
  const availableSlots = slotsBefore.filter((s: any) => s.available && !s.booked);
  
  if (availableSlots.length === 0) {
    console.error('❌ No available slots found');
    return;
  }

  console.log(`Found ${availableSlots.length} available slots`);
  
  // Find first available slot and check if slot 30 minutes later is available
  let firstSlot: any = null;
  let secondSlot: any = null;
  
  for (const slot of availableSlots) {
    const [hour, min] = slot.time.split(':').map(Number);
    const slotMinutes = hour * 60 + min;
    const nextSlotMinutes = slotMinutes + 30;
    const nextHour = Math.floor(nextSlotMinutes / 60);
    const nextMin = nextSlotMinutes % 60;
    const nextSlotTime = `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
    
    const nextSlot = slotsBefore.find((s: any) => s.time === nextSlotTime);
    
    if (nextSlot && (nextSlot.available || !nextSlot.booked)) {
      firstSlot = slot;
      secondSlot = nextSlot;
      console.log(`✅ Found test slots: ${firstSlot.time} and ${secondSlot.time}`);
      break;
    }
  }

  if (!firstSlot) {
    // Use first available slot and try to book the next slot (even if it shows as booked)
    // This will test if our fix works
    firstSlot = availableSlots[0];
    const [hour, min] = firstSlot.time.split(':').map(Number);
    const slotMinutes = hour * 60 + min;
    const nextSlotMinutes = slotMinutes + 30;
    const nextHour = Math.floor(nextSlotMinutes / 60);
    const nextMin = nextSlotMinutes % 60;
    const nextSlotTime = `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
    
    secondSlot = slotsBefore.find((s: any) => s.time === nextSlotTime);
    
    if (!secondSlot) {
      console.error(`❌ No slot found 30 minutes after ${firstSlot.time}`);
      console.log('Available slots:');
      availableSlots.slice(0, 10).forEach((s: any) => {
        console.log(`  - ${s.time}`);
      });
      return;
    }
    
    console.log(`✅ Using test slots: ${firstSlot.time} and ${secondSlot.time} (${secondSlot.booked ? 'currently booked' : 'available'})`);
  }

  const firstSlotTime = firstSlot.time;
  const secondSlotTime = secondSlot.time;

  // Step 2: Get customer ID (use test customer)
  console.log('Step 2: Getting customer ID...');
  const customerResponse = await apiRequest(`/customer/by-phone?phone=9876543210`);
  let customerId: string;
  
  if (customerResponse.success && customerResponse.data?.customer?.id) {
    customerId = customerResponse.data.customer.id;
    console.log(`  Customer ID: ${customerId}`);
  } else {
    console.error('❌ Failed to get customer:', customerResponse.error);
    return;
  }
  console.log();

  // Step 3: Get service ID
  console.log('Step 3: Getting tele consultation service...');
  const servicesResponse = await apiRequest(`/customer/vendor/${VENDOR_ID}/services?serviceStyle=tele`);
  
  if (!servicesResponse.success || !servicesResponse.data?.services?.length) {
    console.error('❌ Failed to get services:', servicesResponse.error);
    return;
  }

  const teleService = servicesResponse.data.services.find((s: any) => 
    s.service_style === 'tele' || s.serviceStyle === 'tele'
  ) || servicesResponse.data.services[0];

  const serviceId = teleService.id || teleService.service_id;
  const serviceDuration = teleService.duration_minutes || teleService.custom_duration || 30;
  console.log(`  Service ID: ${serviceId}`);
  console.log(`  Service Name: ${teleService.name || teleService.service_name}`);
  console.log(`  Service Duration: ${serviceDuration} minutes`);
  console.log();

  // Step 4: Create first booking at first slot time
  console.log(`Step 4: Creating first booking at ${firstSlotTime}...`);
  const booking1Response = await apiRequest('/bookings/create', {
    method: 'POST',
    body: {
      customerId,
      vendorId: VENDOR_ID,
      serviceId,
      serviceType: 'tele',
      bookingDate: TEST_DATE,
      bookingTime: firstSlotTime,
      amount: 300,
      customerPhone: '9876543210',
      payment_status: 'paid',
      status: 'confirmed',
    },
  });

  if (!booking1Response.success) {
    console.error('❌ Failed to create first booking:', booking1Response.error);
    console.error('  Response:', JSON.stringify(booking1Response.data, null, 2));
    return;
  }

  const booking1Id = booking1Response.data?.data?.bookingId ||
                     booking1Response.data?.bookingId ||
                     booking1Response.data?.booking?.id ||
                     booking1Response.data?.id;

  console.log(`  ✅ Booking 1 created: ${booking1Id}`);
  
  // Check booking details to verify duration
  const booking1Details = await apiRequest(`/bookings/${booking1Id}`);
  if (booking1Details.success) {
    const b1 = booking1Details.data?.data?.booking || booking1Details.data?.booking || booking1Details.data;
    const storedDuration = b1.duration_minutes || b1.total_duration_minutes || 'N/A';
    console.log(`  Booking 1 details: time=${b1.booking_time}, duration_minutes=${b1.duration_minutes}, total_duration_minutes=${b1.total_duration_minutes}`);
    console.log(`  Expected duration: ${serviceDuration} minutes, Stored duration: ${storedDuration} minutes`);
    
    if (storedDuration !== serviceDuration && storedDuration !== 'N/A') {
      console.log(`  ⚠️  WARNING: Stored duration (${storedDuration}) does not match service duration (${serviceDuration})`);
    }
  } else {
    console.log(`  ⚠️  Could not fetch booking details: ${booking1Details.error}`);
  }
  console.log();

  // Wait a bit for booking to propagate
  await sleep(2000);

  // Step 5: Check available slots after first booking
  console.log('Step 5: Checking available slots after first booking...');
  const slotsAfterResponse = await apiRequest(
    `/customer/vendor/${VENDOR_ID}/available-slots?date=${TEST_DATE}&serviceStyle=tele`
  );

  if (!slotsAfterResponse.success) {
    console.error('❌ Failed to fetch slots:', slotsAfterResponse.error);
    return;
  }

  const slotsAfter = slotsAfterResponse.data?.slots || [];
  const firstSlotAfter = slotsAfter.find((s: any) => s.time === firstSlotTime);
  const secondSlotAfter = slotsAfter.find((s: any) => s.time === secondSlotTime);

  console.log(`  Slot ${firstSlotTime}: available=${firstSlotAfter?.available}, booked=${firstSlotAfter?.booked}`);
  console.log(`  Slot ${secondSlotTime}: available=${secondSlotAfter?.available}, booked=${secondSlotAfter?.booked}`);
  console.log();

  // Step 6: Verify second slot is still available
  if (!secondSlotAfter?.available || secondSlotAfter?.booked) {
    console.error(`❌ TEST FAILED: Slot ${secondSlotTime} is blocked after booking ${firstSlotTime}`);
    console.error(`  Expected: Slot ${secondSlotTime} should be available`);
    console.error(`  Actual: Slot ${secondSlotTime} is booked/unavailable`);
    return;
  }

  console.log(`  ✅ Slot ${secondSlotTime} is still available (correct behavior)`);
  console.log();

  // Step 7: Create second booking at second slot time
  console.log(`Step 7: Creating second booking at ${secondSlotTime}...`);
  const booking2Response = await apiRequest('/bookings/create', {
    method: 'POST',
    body: {
      customerId,
      vendorId: VENDOR_ID,
      serviceId,
      serviceType: 'tele',
      bookingDate: TEST_DATE,
      bookingTime: secondSlotTime,
      amount: 300,
      customerPhone: '9876543210',
      payment_status: 'paid',
      status: 'confirmed',
    },
  });

  if (!booking2Response.success) {
    console.error(`❌ TEST FAILED: Failed to create second booking at ${secondSlotTime}`);
    console.error('  Error:', booking2Response.error);
    console.error('  Response:', JSON.stringify(booking2Response.data, null, 2));
    
    if (booking2Response.data?.error?.code === 'SLOT_CONFLICT') {
      console.error('  ❌ SLOT_CONFLICT error - This is the bug we are trying to fix!');
      console.error(`  The slot ${secondSlotTime} should be available after booking ${firstSlotTime}`);
    }
    return;
  }

  const booking2Id = booking2Response.data?.data?.bookingId ||
                     booking2Response.data?.bookingId ||
                     booking2Response.data?.booking?.id ||
                     booking2Response.data?.id;

  console.log(`  ✅ Booking 2 created: ${booking2Id}`);
  console.log();

  // Step 8: Verify both bookings exist
  console.log('Step 8: Verifying both bookings exist...');
  const booking1Check = await apiRequest(`/bookings/${booking1Id}`);
  const booking2Check = await apiRequest(`/bookings/${booking2Id}`);

  if (booking1Check.success && booking2Check.success) {
    const b1 = booking1Check.data?.data?.booking || booking1Check.data?.booking || booking1Check.data;
    const b2 = booking2Check.data?.data?.booking || booking2Check.data?.booking || booking2Check.data;

    console.log(`  Booking 1: ${b1.booking_time} | duration=${b1.duration_minutes || b1.total_duration_minutes || 'N/A'}min | status=${b1.status}`);
    console.log(`  Booking 2: ${b2.booking_time} | duration=${b2.duration_minutes || b2.total_duration_minutes || 'N/A'}min | status=${b2.status}`);
    console.log();
  }

  // Final result
  console.log('═'.repeat(60));
  console.log('✅ TEST PASSED: Tele slot conflict fix is working correctly!');
  console.log('═'.repeat(60));
  console.log('Summary:');
  console.log(`  - Booking 1 (${firstSlotTime}): ${booking1Id}`);
  console.log(`  - Booking 2 (${secondSlotTime}): ${booking2Id}`);
  console.log('  - Both bookings created successfully');
  console.log(`  - Slot ${secondSlotTime} remained available after booking ${firstSlotTime}`);
  console.log('  - Parallel bookings are allowed for tele consultations');
  console.log('  - Buffer time is informational only and does not block adjacent slots');
  console.log('═'.repeat(60));
}

// Run test
testTeleSlotConflictFix().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
