/**
 * ============================================================================
 * VET CLINIC BOOKING CREATION TEST
 * ============================================================================
 * 
 * Tests booking creation for vet clinics on vendor dashboard
 * 
 * Run: npx ts-node tests/vet-booking-creation.test.ts
 * ============================================================================
 */

const API_BASE_URL = process.env.TEST_API_URL || process.env.API_URL || 'http://localhost:3000';

interface TestResult {
  step: string;
  passed: boolean;
  error?: string;
  data?: any;
}

async function apiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  headers?: Record<string, string>
): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`\n[API] ${method} ${url}`);
  if (body) {
    console.log(`[API] Body:`, JSON.stringify(body, null, 2));
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  console.log(`[API] Status: ${response.status}`);
  console.log(`[API] Response:`, JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(`API Error (${response.status}): ${data.error || JSON.stringify(data)}`);
  }
  
  return data;
}

async function testVetBookingCreation(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Test data - adjust these IDs based on your test database
  const testData = {
    customerId: process.env.TEST_CUSTOMER_ID || 'test-customer-id',
    vendorId: process.env.TEST_VENDOR_ID || 'test-vendor-id',
    serviceId: process.env.TEST_SERVICE_ID || 'test-service-id',
    petId: process.env.TEST_PET_ID || null,
  };

  // Calculate booking date (tomorrow at 10:00 AM)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const bookingDate = tomorrow.toISOString().split('T')[0];
  const bookingTime = '10:00';

  console.log('\n═'.repeat(60));
  console.log('VET CLINIC BOOKING CREATION TEST');
  console.log('═'.repeat(60));
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Test Data:`, testData);
  console.log(`Booking Date: ${bookingDate} ${bookingTime}`);
  console.log('═'.repeat(60));

  // Step 1: Check if vendor exists
  try {
    console.log('\n[Step 1] Checking vendor...');
    const vendor = await apiRequest(`/vendor/${testData.vendorId}/profile`, 'GET');
    results.push({
      step: '1. Check Vendor',
      passed: true,
      data: { vendorId: vendor.vendor?.id || vendor.id },
    });
    console.log('✅ Vendor found');
  } catch (error: any) {
    results.push({
      step: '1. Check Vendor',
      passed: false,
      error: error.message,
    });
    console.log('⚠️ Vendor check failed (may not exist in test env)');
  }

  // Step 2: Check if service exists
  try {
    console.log('\n[Step 2] Checking service...');
    const service = await apiRequest(`/services/${testData.serviceId}`, 'GET');
    results.push({
      step: '2. Check Service',
      passed: true,
      data: { serviceId: service.service?.id || service.id },
    });
    console.log('✅ Service found');
  } catch (error: any) {
    // Try vendor services endpoint
    try {
      const vendorService = await apiRequest(
        `/vendor/${testData.vendorId}/services`,
        'GET'
      );
      if (vendorService.services && vendorService.services.length > 0) {
        testData.serviceId = vendorService.services[0].id;
        results.push({
          step: '2. Check Service',
          passed: true,
          data: { serviceId: testData.serviceId, source: 'vendor-services' },
        });
        console.log(`✅ Service found from vendor services: ${testData.serviceId}`);
      } else {
        throw new Error('No services found for vendor');
      }
    } catch (err: any) {
      results.push({
        step: '2. Check Service',
        passed: false,
        error: err.message,
      });
      console.log('⚠️ Service check failed');
    }
  }

  // Step 3: Check available slots
  try {
    console.log('\n[Step 3] Checking available slots...');
    const slots = await apiRequest(
      `/bookings/available-slots?vendor_id=${testData.vendorId}&service_id=${testData.serviceId}&date=${bookingDate}`,
      'GET'
    );
    results.push({
      step: '3. Check Available Slots',
      passed: true,
      data: { slotsCount: slots.slots?.length || 0 },
    });
    console.log(`✅ Available slots: ${slots.slots?.length || 0}`);
  } catch (error: any) {
    results.push({
      step: '3. Check Available Slots',
      passed: false,
      error: error.message,
    });
    console.log('⚠️ Slot check failed (continuing anyway)');
  }

  // Step 4: Create booking
  try {
    console.log('\n[Step 4] Creating booking...');
    
    // Generate UUID for idempotency key
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
    
    const bookingPayload = {
      customerId: testData.customerId,
      vendorId: testData.vendorId,
      serviceId: testData.serviceId,
      bookingDate,
      bookingTime,
      serviceType: 'at_center' as const, // Vet clinic booking
      amount: 500, // Test amount
      idempotencyKey: generateUUID(),
      ...(testData.petId && { petId: testData.petId }),
    };

    const bookingResponse = await apiRequest('/bookings/create', 'POST', bookingPayload);
    
    // Handle response format: { success: true, data: { bookingId, status, message, isNew } }
    const bookingId = bookingResponse.data?.bookingId || bookingResponse.bookingId || bookingResponse.booking?.id;
    
    if (bookingId) {
      const bookingStatus = bookingResponse.data?.status || bookingResponse.status || 'pending';
      results.push({
        step: '4. Create Booking',
        passed: true,
        data: { bookingId, status: bookingStatus },
      });
      console.log(`✅ Booking created: ${bookingId} (status: ${bookingStatus})`);
      
      // Step 5: Verify booking exists
      try {
        console.log('\n[Step 5] Verifying booking...');
        const bookingDetailsResponse = await apiRequest(`/bookings/${bookingId}`, 'GET');
        const bookingDetails = bookingDetailsResponse.data?.booking || bookingDetailsResponse.booking || bookingDetailsResponse;
        const verifiedBookingId = bookingDetails.id || bookingDetails.bookingId;
        const verifiedStatus = bookingDetails.status;
        
        results.push({
          step: '5. Verify Booking',
          passed: verifiedBookingId === bookingId,
          data: {
            bookingId: verifiedBookingId,
            status: verifiedStatus,
          },
        });
        if (verifiedBookingId === bookingId) {
          console.log(`✅ Booking verified: ${bookingId}`);
        } else {
          console.log(`⚠️ Booking ID mismatch: expected ${bookingId}, got ${verifiedBookingId}`);
        }
      } catch (error: any) {
        results.push({
          step: '5. Verify Booking',
          passed: false,
          error: error.message,
        });
        console.log(`❌ Booking verification failed: ${error.message}`);
      }

      // Step 6: Check vendor bookings endpoint
      try {
        console.log('\n[Step 6] Checking vendor bookings...');
        const vendorBookingsResponse = await apiRequest(
          `/vendor/bookings/${testData.vendorId}`,
          'GET'
        );
        const vendorBookings = vendorBookingsResponse.bookings || vendorBookingsResponse.data?.bookings || [];
        const foundBooking = vendorBookings.find(
          (b: any) => b.id === bookingId || b.bookingId === bookingId
        );
        results.push({
          step: '6. Check Vendor Bookings',
          passed: foundBooking !== undefined,
          data: {
            totalBookings: vendorBookings.length,
            found: foundBooking !== undefined,
          },
        });
        if (foundBooking) {
          console.log(`✅ Booking found in vendor bookings list`);
        } else {
          console.log(`⚠️ Booking not found in vendor bookings list (may take time to appear)`);
        }
      } catch (error: any) {
        results.push({
          step: '6. Check Vendor Bookings',
          passed: false,
          error: error.message,
        });
        console.log(`❌ Vendor bookings check failed: ${error.message}`);
      }
    } else {
      throw new Error('Booking ID not returned in response');
    }
  } catch (error: any) {
    results.push({
      step: '4. Create Booking',
      passed: false,
      error: error.message,
    });
    console.log(`❌ Booking creation failed: ${error.message}`);
  }

  return results;
}

// Main execution
async function main() {
  try {
    const results = await testVetBookingCreation();

    // Print summary
    console.log('\n' + '═'.repeat(60));
    console.log('TEST SUMMARY');
    console.log('═'.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach(r => {
      const icon = r.passed ? '✅' : '❌';
      console.log(`${icon} ${r.step}`);
      if (r.error) {
        console.log(`   Error: ${r.error}`);
      }
      if (r.data) {
        console.log(`   Data: ${JSON.stringify(r.data)}`);
      }
    });

    console.log('\n' + '─'.repeat(60));
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log('═'.repeat(60));

    if (failed > 0) {
      console.log('\n❌ Some tests failed. Review errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { testVetBookingCreation };
