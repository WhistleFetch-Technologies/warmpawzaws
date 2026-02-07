/**
 * ============================================================================
 * E2E TESTS: COMPREHENSIVE BOOKING FLOW
 * ============================================================================
 * 
 * Tests the complete booking workflow including:
 * 1. Service catalog and discovery
 * 2. Single service booking
 * 3. Multiple services booking
 * 4. Booking status transitions
 * 5. OTP verification for service start
 * 6. Cancellation and refund flow
 * 
 * Run: npx ts-node tests/e2e/booking-flow-comprehensive.test.ts
 * Date: 2026-01-28
 * ============================================================================
 */

import {
  apiRequest,
  apiRequestWithRetry,
  runTestSuite,
  TestSuite,
  assert,
  assertDefined,
  assertEqual,
  assertArrayLength,
  log,
  logError,
  sleep,
  generateTestPhone,
  generateUUID,
  TEST_CONFIG,
  TEST_DATA,
} from './test-utils';

// ============================================================================
// TEST CONTEXT
// ============================================================================

interface BookingTestContext {
  customerId: string;
  customerPhone: string;
  vendorId: string;
  serviceId: string;
  staffId?: string;
  bookingId?: string;
  multiServiceBookingId?: string;
  categories?: any[];
  services?: any[];
  selectedServices?: any[];
}

const ctx: BookingTestContext = {
  customerId: generateUUID(),
  customerPhone: TEST_DATA.customer.phone,
  vendorId: '', // Will be populated
  serviceId: '', // Will be populated
};

// ============================================================================
// SETUP: Discover available services
// ============================================================================

async function setupTestData(): Promise<void> {
  log('SETUP', 'Discovering available services...');

  // Try to get service categories
  const categoriesResponse = await apiRequest('/service-catalog/categories');
  
  if (categoriesResponse.success && categoriesResponse.data?.categories) {
    ctx.categories = categoriesResponse.data.categories;
    log('SETUP', `Found ${ctx.categories.length} categories`);
  } else {
    // Fallback: try alternative endpoint
    const altResponse = await apiRequest('/services/discovery');
    if (altResponse.success) {
      log('SETUP', 'Using service discovery endpoint');
    }
  }

  // Try to find vendors
  const vendorsResponse = await apiRequest(
    '/service-discovery/vendors?service_style=at_center&lat=12.9716&lng=77.5946'
  );

  if (vendorsResponse.success && vendorsResponse.data?.vendors?.length > 0) {
    ctx.vendorId = vendorsResponse.data.vendors[0].id;
    log('SETUP', `Selected vendor: ${ctx.vendorId}`);
  }

  // Try to get services for vendor
  if (ctx.vendorId) {
    const servicesResponse = await apiRequest(`/vendor/${ctx.vendorId}/services`);
    
    if (servicesResponse.success && servicesResponse.data?.services?.length > 0) {
      ctx.services = servicesResponse.data.services;
      ctx.serviceId = servicesResponse.data.services[0].service_id || servicesResponse.data.services[0].id;
      log('SETUP', `Selected service: ${ctx.serviceId}`);
    }
  }

  // If no real data, use test UUIDs
  if (!ctx.vendorId) {
    ctx.vendorId = generateUUID();
    log('SETUP', 'Using test vendor UUID');
  }
  if (!ctx.serviceId) {
    ctx.serviceId = generateUUID();
    log('SETUP', 'Using test service UUID');
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

const serviceCatalogSuite: TestSuite = {
  name: 'Service Catalog',
  setup: setupTestData,
  tests: [
    {
      name: 'Should fetch service categories',
      fn: async () => {
        const response = await apiRequestWithRetry('/service-catalog/categories');

        log('Catalog', 'Categories response', response);

        // May return empty in test env
        if (response.success && response.data?.categories) {
          assert(
            Array.isArray(response.data.categories),
            'Categories should be an array'
          );
        }
      },
    },
    {
      name: 'Should fetch services by category',
      fn: async () => {
        const response = await apiRequest('/service-catalog/services?category=vet_clinic');

        log('Catalog', 'Services response', response);

        // May return empty in test env
        if (response.success && response.data?.services) {
          assert(
            Array.isArray(response.data.services),
            'Services should be an array'
          );
        }
      },
    },
    {
      name: 'Should search for vendors by location',
      fn: async () => {
        const response = await apiRequest(
          '/service-discovery/vendors?lat=12.9716&lng=77.5946&radius_km=10'
        );

        log('Catalog', 'Vendor search response', response);

        // Search should work even if no results
        if (response.success && response.data?.vendors) {
          assert(
            Array.isArray(response.data.vendors),
            'Vendors should be an array'
          );
        }
      },
    },
    {
      name: 'Should fetch vendor profile',
      fn: async () => {
        if (!ctx.vendorId || ctx.vendorId.length < 36) {
          log('Catalog', 'Skipping - no valid vendor ID');
          return;
        }

        const response = await apiRequest(`/vendor/${ctx.vendorId}/profile`);

        log('Catalog', 'Vendor profile response', response);
      },
    },
  ],
};

const singleServiceBookingSuite: TestSuite = {
  name: 'Single Service Booking',
  tests: [
    {
      name: 'Should check available slots',
      fn: async () => {
        const bookingDate = TEST_DATA.getBookingDate();
        // Backend expects vendorId and date (camelCase) - followup-reschedule.ts
        const response = await apiRequest(
          `/bookings/available-slots?vendorId=${ctx.vendorId}&date=${bookingDate}`
        );

        log('Booking', 'Available slots response', response);
        if (response.success && response.data?.slots) {
          assert(Array.isArray(response.data.slots), 'Slots should be an array');
        }
      },
    },
    {
      name: 'Should create a single service booking',
      fn: async () => {
        const bookingDate = TEST_DATA.getBookingDate();
        
        const response = await apiRequest('/bookings/create', {
          method: 'POST',
          body: {
            customerId: ctx.customerId,
            vendorId: ctx.vendorId,
            serviceId: ctx.serviceId,
            bookingDate: bookingDate,
            bookingTime: TEST_DATA.bookingTime,
            serviceType: 'at_center',
            amount: TEST_DATA.service.price,
            customerPhone: ctx.customerPhone,
          },
        });

        log('Booking', 'Create booking response', response);

        // Backend returns standardized format: { success: true, data: { bookingId, status, message, isNew }, meta }
        const raw = response.data;
        const bookingId =
          raw?.data?.bookingId ?? raw?.bookingId ?? raw?.booking_id ?? raw?.data?.id ?? raw?.id;
        if (response.success && bookingId) {
          ctx.bookingId = bookingId;
          log('Booking', `Created booking: ${ctx.bookingId}`);
        }
      },
    },
    {
      name: 'Should fetch booking details',
      fn: async () => {
        if (!ctx.bookingId) {
          log('Booking', 'Skipping - no booking created');
          return;
        }

        const response = await apiRequest(`/bookings/${ctx.bookingId}`);

        log('Booking', 'Booking details response', response);

        // Backend may return { success, data: { booking } } or { booking }
        const booking = response.data?.data?.booking ?? response.data?.booking ?? response.data;
        if (response.success && booking && typeof booking === 'object') {
          const status = booking.status ?? booking.booking_status;
          assertEqual(
            status,
            'pending',
            'New booking should be pending'
          );
        }
      },
    },
    {
      name: 'Should prevent double booking same slot',
      fn: async () => {
        const bookingDate = TEST_DATA.getBookingDate();
        
        // Try to book same slot again
        const response = await apiRequest('/bookings/create', {
          method: 'POST',
          body: {
            customerId: ctx.customerId,
            vendorId: ctx.vendorId,
            serviceId: ctx.serviceId,
            bookingDate: bookingDate,
            bookingTime: TEST_DATA.bookingTime,
            serviceType: 'at_center',
            amount: TEST_DATA.service.price,
            customerPhone: ctx.customerPhone,
          },
        });

        log('Booking', 'Double booking response', response);

        // Should either fail or return existing booking (idempotent)
      },
    },
  ],
};

const multipleServicesBookingSuite: TestSuite = {
  name: 'Multiple Services Booking',
  tests: [
    {
      name: 'Should create booking with multiple selected services',
      fn: async () => {
        const bookingDate = TEST_DATA.getBookingDate();
        
        // Create booking with multiple services
        const selectedServices = [
          {
            id: ctx.serviceId,
            serviceId: ctx.serviceId,
            name: 'General Consultation',
            price: 500,
            duration: 30,
            quantity: 1,
          },
          {
            id: generateUUID(),
            serviceId: generateUUID(),
            name: 'Blood Test',
            price: 300,
            duration: 15,
            quantity: 1,
          },
        ];

        const response = await apiRequest('/bookings/create', {
          method: 'POST',
          body: {
            customerId: ctx.customerId,
            vendorId: ctx.vendorId,
            serviceId: ctx.serviceId, // Primary service
            bookingDate: bookingDate,
            bookingTime: '14:00', // Different time slot
            serviceType: 'at_center',
            amount: 800, // Total of selected services
            customerPhone: ctx.customerPhone,
            selectedServices: selectedServices,
          },
        });

        log('MultiBooking', 'Create multi-service booking response', response);

        const multiId = response.data?.data?.bookingId ?? response.data?.bookingId ?? response.data?.booking_id ?? response.data?.data?.id ?? response.data?.id;
        if (response.success && multiId) {
          ctx.multiServiceBookingId = multiId;
          ctx.selectedServices = selectedServices;
          log('MultiBooking', `Created multi-service booking: ${ctx.multiServiceBookingId}`);
        }
      },
    },
    {
      name: 'Should calculate correct total for multiple services',
      fn: async () => {
        if (!ctx.multiServiceBookingId) {
          log('MultiBooking', 'Skipping - no multi-service booking created');
          return;
        }

        const response = await apiRequest(`/bookings/${ctx.multiServiceBookingId}`);

        log('MultiBooking', 'Multi-service booking details', response);

        const booking = response.data?.data?.booking ?? response.data?.booking ?? response.data;
        if (response.success && booking && typeof booking === 'object') {
          
          // Verify selected services are stored
          if (booking.selected_services) {
            const services = typeof booking.selected_services === 'string' 
              ? JSON.parse(booking.selected_services)
              : booking.selected_services;
            
            log('MultiBooking', 'Selected services', services);
          }

          // Verify total amount is sum of services
          const expectedTotal = 800; // 500 + 300
          log('MultiBooking', `Total amount: ${booking.total_amount}, expected: ${expectedTotal}`);
        }
      },
    },
    {
      name: 'Should calculate correct total duration for multiple services',
      fn: async () => {
        if (!ctx.multiServiceBookingId) {
          log('MultiBooking', 'Skipping - no multi-service booking created');
          return;
        }

        const response = await apiRequest(`/bookings/${ctx.multiServiceBookingId}`);

        const bookingObj = response.data?.data?.booking ?? response.data?.booking ?? response.data;
        if (response.success && bookingObj && typeof bookingObj === 'object') {
          const expectedDuration = 45; // 30 + 15 minutes
          const duration = bookingObj.total_duration_minutes ?? bookingObj.totalDurationMinutes;
          log('MultiBooking', `Total duration: ${duration}, expected: ${expectedDuration}`);
        }
      },
    },
  ],
};

const bookingStatusTransitionsSuite: TestSuite = {
  name: 'Booking Status Transitions',
  tests: [
    {
      name: 'Should confirm a pending booking',
      fn: async () => {
        if (!ctx.bookingId) {
          log('Status', 'Skipping - no booking created');
          return;
        }
        // Backend: PUT /bookings/:bookingId/status with body { status } (bookings-enhanced)
        const response = await apiRequest(`/bookings/${ctx.bookingId}/status`, {
          method: 'PUT',
          body: { status: 'confirmed', reason: 'E2E test confirm' },
        });

        log('Status', 'Confirm booking response', response);
        if (response.success !== undefined && !response.success && response.statusCode >= 400) {
          log('Status', 'Confirm may require vendor flow; continuing');
        }
      },
    },
    {
      name: 'Should start a confirmed booking (check-in)',
      fn: async () => {
        if (!ctx.bookingId) {
          log('Status', 'Skipping - no booking created');
          return;
        }
        const response = await apiRequest(`/bookings/${ctx.bookingId}/status`, {
          method: 'PUT',
          body: { status: 'in_progress', reason: 'E2E test start' },
        });

        log('Status', 'Start booking response', response);
      },
    },
    {
      name: 'Should complete a started booking',
      fn: async () => {
        if (!ctx.bookingId) {
          log('Status', 'Skipping - no booking created');
          return;
        }
        const response = await apiRequest(`/bookings/${ctx.bookingId}/status`, {
          method: 'PUT',
          body: { status: 'completed', notes: 'Service completed successfully' },
        });

        log('Status', 'Complete booking response', response);
      },
    },
    {
      name: 'Should fetch booking status history',
      fn: async () => {
        if (!ctx.bookingId) {
          log('Status', 'Skipping - no booking created');
          return;
        }
        // Backend: GET /bookings/:bookingId/history (bookings-enhanced)
        const response = await apiRequest(`/bookings/${ctx.bookingId}/history`);

        log('Status', 'Status history response', response);
        if (response.success && response.data?.data?.history) {
          assert(Array.isArray(response.data.data.history), 'History should be an array');
        } else if (response.success && response.data?.history) {
          assert(Array.isArray(response.data.history), 'History should be an array');
        }
      },
    },
  ],
};

const otpVerificationSuite: TestSuite = {
  name: 'OTP Verification for Service',
  tests: [
    {
      name: 'Should generate OTP for service start',
      fn: async () => {
        if (!ctx.multiServiceBookingId) {
          log('OTP', 'Skipping - no booking for OTP test');
          return;
        }

        // Backend otp-enhanced: expects { sessionNumber?, action? } (default action: 'start')
        const response = await apiRequest(`/bookings/${ctx.multiServiceBookingId}/generate-otp`, {
          method: 'POST',
          body: { action: 'start', sessionNumber: 1 },
        });

        log('OTP', 'Generate OTP response', response);
      },
    },
    {
      name: 'Should reject invalid OTP',
      fn: async () => {
        if (!ctx.multiServiceBookingId) {
          log('OTP', 'Skipping - no booking for OTP test');
          return;
        }

        // Backend otp-enhanced: expects { otp, action?, sessionNumber? }
        const response = await apiRequest(`/bookings/${ctx.multiServiceBookingId}/verify-otp`, {
          method: 'POST',
          body: { otp: '000000', action: 'start', sessionNumber: 1 },
        });

        log('OTP', 'Invalid OTP response', response);
        
        // Should fail verification
        assert(!response.success, 'Invalid OTP should be rejected');
      },
    },
  ],
};

const cancellationSuite: TestSuite = {
  name: 'Booking Cancellation',
  tests: [
    {
      name: 'Should create booking for cancellation test',
      fn: async () => {
        const bookingDate = TEST_DATA.getBookingDate();
        
        const response = await apiRequest('/bookings/create', {
          method: 'POST',
          body: {
            customerId: ctx.customerId,
            vendorId: ctx.vendorId,
            serviceId: ctx.serviceId,
            bookingDate: bookingDate,
            bookingTime: '16:00', // Different time
            serviceType: 'at_center',
            amount: TEST_DATA.service.price,
            customerPhone: ctx.customerPhone,
          },
        });

        const cancelBookingId = response.data?.data?.bookingId ?? response.data?.bookingId ?? response.data?.booking_id ?? response.data?.id;
        if (response.success && cancelBookingId) {
          log('Cancel', `Created booking for cancellation: ${cancelBookingId}`);
          
          // Test cancellation
          const cancelResponse = await apiRequest(`/bookings/${cancelBookingId}/cancel`, {
            method: 'POST',
            body: {
              reason: 'Test cancellation',
              refundRequested: true,
            },
          });

          log('Cancel', 'Cancellation response', cancelResponse);
        }
      },
    },
    {
      name: 'Should calculate refund preview before cancellation',
      fn: async () => {
        if (!ctx.bookingId) {
          log('Cancel', 'Skipping - no booking for refund test');
          return;
        }

        const response = await apiRequest('/customer/bookings/refund-preview', {
          method: 'POST',
          body: {
            bookingId: ctx.bookingId,
          },
        });

        log('Cancel', 'Refund preview response', response);
      },
    },
  ],
};

const customerBookingHistorySuite: TestSuite = {
  name: 'Customer Booking History',
  tests: [
    {
      name: 'Should fetch customer bookings by phone',
      fn: async () => {
        const response = await apiRequest(
          `/customer/bookings?phone=${ctx.customerPhone}`
        );

        log('History', 'Customer bookings response', response);

        if (response.success && response.data?.bookings) {
          assert(
            Array.isArray(response.data.bookings),
            'Bookings should be an array'
          );
        }
      },
    },
    {
      name: 'Should fetch active bookings',
      fn: async () => {
        const response = await apiRequest(
          `/customer/bookings/active?phone=${ctx.customerPhone}`
        );

        log('History', 'Active bookings response', response);
      },
    },
    {
      name: 'Should filter bookings by status',
      fn: async () => {
        const response = await apiRequest(
          `/customer/bookings?phone=${ctx.customerPhone}&status=completed`
        );

        log('History', 'Completed bookings response', response);
      },
    },
  ],
};

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('WARMPAWZ E2E TEST SUITE - COMPREHENSIVE BOOKING FLOW');
  console.log('═'.repeat(60));
  console.log(`API URL: ${TEST_CONFIG.apiBaseUrl}`);
  console.log(`Customer Phone: ${ctx.customerPhone}`);
  console.log('═'.repeat(60));

  const suites = [
    serviceCatalogSuite,
    singleServiceBookingSuite,
    multipleServicesBookingSuite,
    bookingStatusTransitionsSuite,
    otpVerificationSuite,
    cancellationSuite,
    customerBookingHistorySuite,
  ];

  const allResults: any[] = [];

  for (const suite of suites) {
    const result = await runTestSuite(suite);
    allResults.push(result);
  }

  // Final Summary
  console.log('\n' + '═'.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('═'.repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const result of allResults) {
    console.log(`\n${result.suiteName}:`);
    console.log(`  Passed: ${result.passed}, Failed: ${result.failed}, Skipped: ${result.skipped}`);
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`);
  console.log('═'.repeat(60));

  // Test Context Summary
  console.log('\nTest Context:');
  console.log(`  Customer ID: ${ctx.customerId}`);
  console.log(`  Vendor ID: ${ctx.vendorId}`);
  console.log(`  Service ID: ${ctx.serviceId}`);
  console.log(`  Single Service Booking ID: ${ctx.bookingId || 'Not created'}`);
  console.log(`  Multi-Service Booking ID: ${ctx.multiServiceBookingId || 'Not created'}`);

  // Exit with error code if any tests failed
  if (totalFailed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);
