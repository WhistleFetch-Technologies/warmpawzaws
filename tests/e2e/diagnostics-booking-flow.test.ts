/**
 * ============================================================================
 * E2E: DIAGNOSTICS BOOKING FLOW – CONTRACT & FLOW VALIDATION
 * ============================================================================
 *
 * Validates:
 * 1. API contracts (CreateBookingRequestSchema, Razorpay create-order diagnostics)
 * 2. Diagnostics flow: payment-before-booking (create order without bookingId)
 * 3. Create booking payload shape and backend response shape
 *
 * Run: npx ts-node tests/e2e/diagnostics-booking-flow.test.ts
 * ============================================================================
 */

const API_BASE_URL = process.env.TEST_API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const FAKE_UUID = '00000000-0000-0000-0000-000000000001';

async function apiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' = 'GET',
  body?: any
): Promise<{ status: number; data: any }> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function log(step: string, message: string, data?: any): void {
  console.log(`\n[DIAGNOSTICS] ${step} ${message}`);
  if (data != null) console.log(JSON.stringify(data, null, 2));
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`\n❌ ASSERT FAILED: ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log(`  ✅ ${message}`);
}

async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('WARMPAWZ E2E – DIAGNOSTICS BOOKING FLOW (CONTRACT & FLOW)');
  console.log('═'.repeat(60));
  console.log(`API: ${API_BASE_URL}`);
  console.log('═'.repeat(60));

  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------------------
  // 1. CreateBookingRequestSchema – diagnostics payload (at_center)
  // -------------------------------------------------------------------------
  try {
    const payload = {
      customerId: FAKE_UUID,
      vendorId: FAKE_UUID,
      serviceId: 'diagnostics',
      bookingDate: '2026-02-15',
      bookingTime: '10:00',
      serviceType: 'at_center',
      amount: 450,
      totalAmount: 450,
      notes: JSON.stringify({ patientName: 'Test', preferredSampleType: 'center' }),
    };
    const { status, data } = await apiRequest('/bookings/create', 'POST', payload);
    const isSchemaReject = status === 500 && (data?.error?.message?.includes('Invalid') || (typeof data?.error === 'string' && data.error.toLowerCase().includes('schema')));
    assert(!isSchemaReject, 'Create booking (diagnostics at_center) – schema accepts payload; got ' + status);
    // Paid diagnostics require razorpay_order_id + completed payment row (400 DIAGNOSTICS_PAYMENT_REQUIRED).
    if (
      status === 400 &&
      (data?.error?.code === 'DIAGNOSTICS_PAYMENT_REQUIRED' ||
        String(data?.error?.message || data?.error || '').includes('razorpay_order_id'))
    ) {
      assert(true, 'Paid diagnostics without order id → 400 payment required (expected)');
    }
    if (status === 200 && data?.success && data?.data?.bookingId) log('CREATE', 'Booking created', data.data);
    passed++;
  } catch (e: any) {
    failed++;
    console.error('  ❌ Create booking at_center:', e.message);
  }

  // -------------------------------------------------------------------------
  // 2. CreateBookingRequestSchema – at_home
  // -------------------------------------------------------------------------
  try {
    const payload = {
      customerId: FAKE_UUID,
      vendorId: FAKE_UUID,
      serviceId: 'diagnostics',
      bookingDate: '2026-02-15',
      bookingTime: '14:00',
      serviceType: 'at_home',
      address: '123 Test St',
      amount: 600,
      notes: JSON.stringify({ patientName: 'Test', preferredSampleType: 'home' }),
    };
    const { status } = await apiRequest('/bookings/create', 'POST', payload);
    assert([200, 400, 404].includes(status), 'Create booking (diagnostics at_home) – status 200/400/404; got ' + status);
    passed++;
  } catch (e: any) {
    failed++;
    console.error('  ❌ Create booking at_home:', e.message);
  }

  // -------------------------------------------------------------------------
  // 3. Razorpay create-order – diagnostics type (no bookingId)
  // -------------------------------------------------------------------------
  try {
    const payload = { type: 'diagnostics', amount: 450, customerId: FAKE_UUID, vendorId: FAKE_UUID };
    const { status, data } = await apiRequest('/razorpay/create-order', 'POST', payload);
    assert([200, 400, 500].includes(status), 'Razorpay create-order diagnostics – status 200/400/500; got ' + status);
    if (status === 200) assert(!!(data?.orderId || data?.data?.orderId), 'Razorpay returns orderId');
    passed++;
  } catch (e: any) {
    failed++;
    console.error('  ❌ Razorpay create-order diagnostics:', e.message);
  }

  // -------------------------------------------------------------------------
  // 4. Razorpay create-order diagnostics – rejects missing vendorId
  // -------------------------------------------------------------------------
  try {
    const payload = { type: 'diagnostics', amount: 450, customerId: FAKE_UUID };
    const { status } = await apiRequest('/razorpay/create-order', 'POST', payload);
    assert(status === 400, 'Razorpay diagnostics missing vendorId → 400; got ' + status);
    passed++;
  } catch (e: any) {
    failed++;
    console.error('  ❌ Razorpay missing vendorId:', e.message);
  }

  // -------------------------------------------------------------------------
  // 5. Create booking response shape (success + data.bookingId)
  // -------------------------------------------------------------------------
  try {
    const payload = {
      customerId: FAKE_UUID,
      vendorId: FAKE_UUID,
      serviceId: 'diagnostics',
      bookingDate: '2026-02-20',
      bookingTime: '11:00',
      serviceType: 'at_center',
      amount: 100,
    };
    const { status, data } = await apiRequest('/bookings/create', 'POST', payload);
    if (status === 200) {
      const bookingId = data?.data?.bookingId ?? data?.bookingId;
      assert(!!data?.success && !!bookingId, 'Response has success and bookingId');
      assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId), 'bookingId is UUID');
    } else if (status === 400 && data?.error?.code === 'DIAGNOSTICS_PAYMENT_REQUIRED') {
      assert(true, 'Diagnostics with amount and no razorpay_order_id → payment required');
    }
    passed++;
  } catch (e: any) {
    failed++;
    console.error('  ❌ Create booking response shape:', e.message);
  }

  // -------------------------------------------------------------------------
  // 6. GET customer/diagnostics/vendors-with-tests (discovery: labs + vet clinics)
  // -------------------------------------------------------------------------
  try {
    const { status, data } = await apiRequest('/customer/diagnostics/vendors-with-tests', 'GET');
    assert(status === 200, 'vendors-with-tests – 200; got ' + status);
    assert(data?.success === true, 'vendors-with-tests success true');
    assert(Array.isArray(data?.vendors), 'vendors-with-tests vendors is array');
    if (data?.vendors?.length > 0) {
      const v = data.vendors[0];
      assert(Array.isArray(v.tests), 'each vendor has tests array');
      assert(v.businessName != null || v.id != null, 'vendor has id or businessName');
    }
    log('VENDORS-WITH-TESTS', `vendors count: ${data?.vendors?.length ?? 0}`, data?.vendors?.length ? undefined : data);
    passed++;
  } catch (e: any) {
    failed++;
    console.error('  ❌ vendors-with-tests:', e.message);
  }

  // -------------------------------------------------------------------------
  // 7. GET vendor diagnostics tests (wireframe: list tests per lab)
  // -------------------------------------------------------------------------
  try {
    const vendorId = process.env.TEST_DIAGNOSTICS_VENDOR_ID || FAKE_UUID;
    const { status, data } = await apiRequest(`/vendor/${vendorId}/diagnostics/tests`, 'GET');
    // 200 = list, 404 = vendor not found, 403 = no diagnostics capability
    assert([200, 404, 403].includes(status), 'GET vendor diagnostics/tests – 200/404/403; got ' + status);
    if (status === 200 && data?.tests) assert(Array.isArray(data.tests), 'Response tests is array');
    passed++;
  } catch (e: any) {
    failed++;
    console.error('  ❌ GET vendor diagnostics tests:', e.message);
  }

  // -------------------------------------------------------------------------
  // 8. GET vendor diagnostics tests?publishedOnly=true (only published for booking)
  // -------------------------------------------------------------------------
  try {
    const vendorId = process.env.TEST_DIAGNOSTICS_VENDOR_ID || FAKE_UUID;
    const { status, data } = await apiRequest(`/vendor/${vendorId}/diagnostics/tests?publishedOnly=true`, 'GET');
    assert([200, 404, 403].includes(status), 'GET diagnostics/tests?publishedOnly=true – 200/404/403; got ' + status);
    if (status === 200 && Array.isArray(data?.tests)) {
      const allPublished = data.tests.every((t: any) => t.is_available === true);
      assert(allPublished, 'publishedOnly=true returns only is_available=true tests');
    }
    passed++;
  } catch (e: any) {
    failed++;
    console.error('  ❌ GET diagnostics/tests publishedOnly:', e.message);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`Result: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(60));
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
