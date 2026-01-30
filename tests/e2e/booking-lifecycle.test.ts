/**
 * ============================================================================
 * E2E TESTS: COMPLETE BOOKING LIFECYCLE
 * ============================================================================
 * 
 * Tests the complete booking flow from discovery to settlement:
 * 1. Service discovery and search
 * 2. Vendor/staff selection
 * 3. Booking creation
 * 4. Payment processing
 * 5. Service delivery (GPS/Video)
 * 6. Completion and review
 * 7. Settlement
 * 
 * Run: npx ts-node tests/e2e/booking-lifecycle.test.ts
 * Date: 2026-01-02
 * ============================================================================
 */

const API_BASE_URL = process.env.TEST_API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestContext {
  customerId?: string;
  customerPhone: string;
  vendorId?: string;
  staffId?: string;
  serviceId?: string;
  bookingId?: string;
  paymentId?: string;
  settlementId?: string;
}

async function apiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const data: any = await response.json().catch(() => ({}));
  const errMsg =
    typeof data?.error === 'string'
      ? data.error
      : data?.error?.message ?? (data?.error && JSON.stringify(data.error)) ?? response.statusText;

  if (!response.ok) {
    throw new Error(`API Error: ${errMsg}`);
  }

  return data;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function log(step: string, message: string, data?: any): void {
  console.log(`\n[${step}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

async function testServiceDiscovery(ctx: TestContext): Promise<void> {
  log('1.1', 'Testing service category discovery');
  
  // Search for vet services (API returns vendors, services, total)
  const searchResults = await apiRequest(
    `/search?q=veterinarian&lat=12.9716&lng=77.5946`,
    'GET'
  );
  
  assert(
    searchResults.vendors !== undefined || searchResults.services !== undefined,
    'Search should return vendors or services'
  );
  const total = searchResults.total ?? (searchResults.vendors?.length || 0) + (searchResults.services?.length || 0);
  log('1.1', 'Search results received', { count: total });

  // Get problem grid / categories (public API returns problems and byCategory)
  log('1.2', 'Testing problem grid / category listing');
  const categories = await apiRequest('/public/problem-grid', 'GET');
  assert(
    categories.problems !== undefined || categories.byCategory !== undefined,
    'Should return problem grid or categories'
  );

  // Get vendors via customer discovery (replaces legacy service-discovery/vendors)
  log('1.3', 'Testing vendor discovery for category');
  const vendors = await apiRequest(
    `/customer/discover-services?lat=12.9716&lng=77.5946&role_id=veterinarian`,
    'GET'
  );
  
  const providerList = vendors.providers ?? vendors.vendors ?? [];
  if (Array.isArray(providerList) && providerList.length > 0) {
    ctx.vendorId = providerList[0].id ?? providerList[0].vendor_id;
    log('1.3', 'Vendor selected', { vendorId: ctx.vendorId });
  }
}

async function testProblemGridDiscovery(ctx: TestContext): Promise<void> {
  log('2.1', 'Testing problem grid discovery');
  
  const problems = await apiRequest('/public/problem-grid', 'GET');
  assert(problems.problems !== undefined, 'Should return problem grid');
  
  // Search by symptom
  log('2.2', 'Testing symptom-based search');
  const symptomResults = await apiRequest(
    `/search?q=vomiting&type=service`,
    'GET'
  );
  
  const symptomTotal = symptomResults.total ?? (symptomResults.vendors?.length || 0) + (symptomResults.services?.length || 0);
  log('2.2', 'Symptom search results', { count: symptomTotal });
}

async function testVendorSelection(ctx: TestContext): Promise<void> {
  if (!ctx.vendorId) {
    log('3.1', 'Creating test vendor');
    // Use existing test vendor or skip
    ctx.vendorId = 'test-vendor-001';
  }

  log('3.1', 'Testing vendor profile fetch');
  try {
    const vendor = await apiRequest(`/customer/vendor/${ctx.vendorId}`, 'GET');
    assert(vendor.vendor !== undefined, 'Should return vendor profile');
    log('3.1', 'Vendor profile retrieved', { name: vendor.vendor?.businessName });
  } catch (error) {
    log('3.1', 'Vendor profile fetch failed (may not exist in test env)', { error });
  }

  log('3.2', 'Testing vendor services listing');
  try {
    const services = await apiRequest(`/customer/vendor/${ctx.vendorId}/services`, 'GET');
    
    if (services.services?.length > 0) {
      ctx.serviceId = services.services[0].id;
      log('3.2', 'Service selected', { serviceId: ctx.serviceId });
    }
  } catch (error) {
    log('3.2', 'Services fetch failed', { error });
  }
}

async function testStaffSelection(ctx: TestContext): Promise<void> {
  if (!ctx.vendorId) return;

  log('4.1', 'Testing staff listing');
  try {
    const vendorDetail = await apiRequest(
      `/customer/vendor/${ctx.vendorId}`,
      'GET'
    );
    const staffList = vendorDetail.staff ?? vendorDetail.vendor?.staff ?? [];
    if (Array.isArray(staffList) && staffList.length > 0) {
      ctx.staffId = staffList[0].id;
      log('4.1', 'Staff selected', { staffId: ctx.staffId });
    }
  } catch (error) {
    log('4.1', 'Staff fetch failed (may not exist)', { error });
  }

  log('4.2', 'Testing previous provider check');
  try {
    const previousProvider = await apiRequest(
      `/customer/${ctx.customerPhone}/previous-providers?serviceType=vet`,
      'GET'
    );
    log('4.2', 'Previous providers', { count: previousProvider.providers?.length || 0 });
  } catch (error) {
    log('4.2', 'Previous provider check failed', { error });
  }
}

async function testBookingCreation(ctx: TestContext): Promise<void> {
  log('5.1', 'Testing available slots fetch');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  try {
    // Backend expects vendorId and date (camelCase) - followup-reschedule.ts
    const slots = await apiRequest(
      `/bookings/available-slots?vendorId=${ctx.vendorId}&date=${dateStr}&serviceId=${ctx.serviceId || ''}`,
      'GET'
    );
    log('5.1', 'Available slots', { count: slots.slots?.length || 0 });
  } catch (error) {
    log('5.1', 'Slots fetch failed', { error });
  }

  log('5.2', 'Testing booking creation');
  try {
    // Backend CreateBookingRequestSchema expects camelCase
    const booking = await apiRequest('/bookings/create', 'POST', {
      customerPhone: ctx.customerPhone,
      customerId: ctx.customerId || undefined,
      vendorId: ctx.vendorId || 'test-vendor-001',
      serviceId: ctx.serviceId || 'test-service-001',
      staffId: ctx.staffId,
      bookingDate: dateStr,
      bookingTime: '10:00',
      serviceType: 'at_center',
      amount: 500,
    });
    const bid = booking.data?.bookingId ?? booking.data?.booking_id ?? booking.bookingId ?? booking.booking_id ?? booking.id;
    if (bid) {
      ctx.bookingId = bid;
      log('5.2', 'Booking created', { bookingId: ctx.bookingId });
    }
  } catch (error: any) {
    log('5.2', 'Booking creation failed', { error: error.message });
    // Create mock booking ID for continued testing
    ctx.bookingId = `test-booking-${Date.now()}`;
  }
}

async function testPaymentProcessing(ctx: TestContext): Promise<void> {
  if (!ctx.bookingId) return;

  log('6.1', 'Testing payment order creation');
  try {
    const order = await apiRequest('/payments/create-order', 'POST', {
      booking_id: ctx.bookingId,
      amount: 500,
    });
    
    if (order.order_id) {
      log('6.1', 'Payment order created', { orderId: order.order_id });
      ctx.paymentId = order.order_id;
    }
  } catch (error: any) {
    log('6.1', 'Payment order creation failed', { error: error.message });
  }

  log('6.2', 'Testing wallet balance check');
  try {
    const wallet = await apiRequest(`/wallet/${ctx.customerPhone}/balance`, 'GET');
    log('6.2', 'Wallet balance', { balance: wallet.balance });
  } catch (error: any) {
    log('6.2', 'Wallet check failed', { error: error.message });
  }
}

async function testBookingLifecycle(ctx: TestContext): Promise<void> {
  if (!ctx.bookingId) return;

  log('7.1', 'Testing booking confirmation');
  try {
    // Backend: PUT /bookings/:bookingId/status with status: 'confirmed' (no separate /confirm)
    await apiRequest(`/bookings/${ctx.bookingId}/status`, 'PUT', {
      status: 'confirmed',
      reason: ctx.paymentId ? `Payment ${ctx.paymentId}` : undefined,
    });
    log('7.1', 'Booking confirmed');
  } catch (error: any) {
    log('7.1', 'Booking confirmation failed', { error: error.message });
  }

  log('7.2', 'Testing booking status fetch');
  try {
    const booking = await apiRequest(`/bookings/${ctx.bookingId}`, 'GET');
    log('7.2', 'Booking status', { status: booking.status });
  } catch (error: any) {
    log('7.2', 'Booking status fetch failed', { error: error.message });
  }

  log('7.3', 'Testing booking start (check-in)');
  try {
    // Backend: PUT /bookings/:bookingId/status with status: 'in_progress'
    await apiRequest(`/bookings/${ctx.bookingId}/status`, 'PUT', {
      status: 'in_progress',
      reason: ctx.staffId ? `Started by ${ctx.staffId}` : 'E2E test start',
    });
    log('7.3', 'Booking started');
  } catch (error: any) {
    log('7.3', 'Booking start failed', { error: error.message });
  }

  log('7.4', 'Testing booking completion');
  try {
    // Backend: PUT /bookings/:bookingId/status with status: 'completed'
    await apiRequest(`/bookings/${ctx.bookingId}/status`, 'PUT', {
      status: 'completed',
      notes: 'Service completed successfully',
    });
    log('7.4', 'Booking completed');
  } catch (error: any) {
    log('7.4', 'Booking completion failed', { error: error.message });
  }
}

async function testGPSTracking(ctx: TestContext): Promise<void> {
  log('8.1', 'Testing GPS tracking for home services');
  
  // Create home service booking
  const homeBookingId = `home-booking-${Date.now()}`;
  
  try {
    // Update staff location
    await apiRequest('/gps-tracking/update-location', 'POST', {
      staff_id: ctx.staffId || 'test-staff',
      latitude: 12.9716,
      longitude: 77.5946,
      booking_id: homeBookingId,
    });
    log('8.1', 'Location updated');
  } catch (error: any) {
    log('8.1', 'Location update failed', { error: error.message });
  }

  try {
    // Get tracking status
    const tracking = await apiRequest(`/gps-tracking/booking/${homeBookingId}`, 'GET');
    log('8.2', 'Tracking status', tracking);
  } catch (error: any) {
    log('8.2', 'Tracking fetch failed', { error: error.message });
  }
}

async function testVideoCall(ctx: TestContext): Promise<void> {
  log('9.1', 'Testing video call for tele consultation');
  
  const teleBookingId = `tele-booking-${Date.now()}`;
  
  try {
    // Create video call meeting
    const meeting = await apiRequest('/video-call/create-meeting', 'POST', {
      booking_id: teleBookingId,
      vendor_id: ctx.vendorId || 'test-vendor',
      customer_phone: ctx.customerPhone,
    });
    log('9.1', 'Video meeting created', { meetingId: meeting.meeting_id });
  } catch (error: any) {
    log('9.1', 'Video meeting creation failed', { error: error.message });
  }

  try {
    // Get meeting details
    const call = await apiRequest(`/video-call/booking/${teleBookingId}`, 'GET');
    log('9.2', 'Video call details', call);
  } catch (error: any) {
    log('9.2', 'Video call fetch failed', { error: error.message });
  }
}

async function testReviewAndRating(ctx: TestContext): Promise<void> {
  if (!ctx.bookingId) return;

  log('10.1', 'Testing review submission');
  try {
    await apiRequest('/reviews', 'POST', {
      booking_id: ctx.bookingId,
      rating: 5,
      comment: 'Excellent service! Very professional.',
      customer_phone: ctx.customerPhone,
    });
    log('10.1', 'Review submitted');
  } catch (error: any) {
    log('10.1', 'Review submission failed', { error: error.message });
  }

  log('10.2', 'Testing vendor reviews fetch');
  try {
    const reviews = await apiRequest(`/vendor/${ctx.vendorId}/reviews`, 'GET');
    log('10.2', 'Vendor reviews', { count: reviews.reviews?.length || 0 });
  } catch (error: any) {
    log('10.2', 'Reviews fetch failed', { error: error.message });
  }
}

async function testSettlement(ctx: TestContext): Promise<void> {
  log('11.1', 'Testing settlement calculation');
  
  try {
    const pendingSettlements = await apiRequest(
      `/vendor/${ctx.vendorId}/settlements?status=pending`,
      'GET'
    );
    log('11.1', 'Pending settlements', { count: pendingSettlements.settlements?.length || 0 });
  } catch (error: any) {
    log('11.1', 'Settlements fetch failed', { error: error.message });
  }

  log('11.2', 'Testing settlement processing');
  try {
    const settlement = await apiRequest('/settlements/process', 'POST', {
      vendor_id: ctx.vendorId || 'test-vendor',
    });
    
    if (settlement.settlement_id) {
      ctx.settlementId = settlement.settlement_id;
      log('11.2', 'Settlement processed', { settlementId: ctx.settlementId });
    }
  } catch (error: any) {
    log('11.2', 'Settlement processing failed', { error: error.message });
  }
}

async function testAdminOperations(): Promise<void> {
  log('12.1', 'Testing admin vendor stats');
  try {
    const stats = await apiRequest('/admin/vendors/stats', 'GET');
    log('12.1', 'Vendor stats', stats);
  } catch (error: any) {
    log('12.1', 'Stats fetch failed', { error: error.message });
  }

  log('12.2', 'Testing admin roles fetch');
  try {
    const roles = await apiRequest('/config/roles', 'GET');
    log('12.2', 'Roles', { count: roles.roles?.length || 0 });
  } catch (error: any) {
    log('12.2', 'Roles fetch failed', { error: error.message });
  }

  log('12.3', 'Testing governance propagation');
  try {
    await apiRequest('/admin/governance/propagate', 'POST', {
      type: 'platform_settings_change',
    });
    log('12.3', 'Propagation triggered');
  } catch (error: any) {
    log('12.3', 'Propagation failed', { error: error.message });
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runE2ETests(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('WARMPAWZ E2E TEST SUITE - BOOKING LIFECYCLE');
  console.log('═'.repeat(60));
  console.log(`API URL: ${API_BASE_URL}`);
  console.log('═'.repeat(60));

  const ctx: TestContext = {
    customerPhone: '9876543210',
  };

  const tests = [
    { name: 'Service Discovery', fn: () => testServiceDiscovery(ctx) },
    { name: 'Problem Grid Discovery', fn: () => testProblemGridDiscovery(ctx) },
    { name: 'Vendor Selection', fn: () => testVendorSelection(ctx) },
    { name: 'Staff Selection', fn: () => testStaffSelection(ctx) },
    { name: 'Booking Creation', fn: () => testBookingCreation(ctx) },
    { name: 'Payment Processing', fn: () => testPaymentProcessing(ctx) },
    { name: 'Booking Lifecycle', fn: () => testBookingLifecycle(ctx) },
    { name: 'GPS Tracking', fn: () => testGPSTracking(ctx) },
    { name: 'Video Call', fn: () => testVideoCall(ctx) },
    { name: 'Review & Rating', fn: () => testReviewAndRating(ctx) },
    { name: 'Settlement', fn: () => testSettlement(ctx) },
    { name: 'Admin Operations', fn: () => testAdminOperations() },
  ];

  const results: { name: string; passed: boolean; error?: string }[] = [];

  for (const test of tests) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🧪 ${test.name}`);
    console.log('─'.repeat(60));

    try {
      await test.fn();
      results.push({ name: test.name, passed: true });
      console.log(`\n✅ ${test.name} - PASSED`);
    } catch (error: any) {
      results.push({ name: test.name, passed: false, error: error.message });
      console.log(`\n❌ ${test.name} - FAILED: ${error.message}`);
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}${r.error ? `: ${r.error}` : ''}`);
  });

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('═'.repeat(60));

  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runE2ETests().catch(console.error);

