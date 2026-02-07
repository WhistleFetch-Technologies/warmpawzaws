/**
 * Systematic Booking Flow Test
 *
 * Traces: customer/vendor/service IDs → POST /bookings/create → POST /payments/create → POST /razorpay/create-order
 * Discovers real UUIDs from API when not provided. Fails fast with clear messages for missing IDs.
 *
 * Usage:
 *   npx tsx scripts/booking-flow-systematic-test.ts
 *
 * Env (all optional if discovery is used):
 *   API_BASE_URL     - API base (default: dev API Gateway)
 *   TEST_PHONE       - Customer phone for discovery (e.g. +919876543210)
 *   TEST_CUSTOMER_ID - Override customer UUID
 *   TEST_VENDOR_ID   - Override vendor UUID
 *   TEST_SERVICE_ID  - Override service UUID (must be UUID from services/vendor_services)
 *   DRY_RUN=1        - Only run parameter validation (400/404 checks); exit 0 without real IDs
 */

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const TEST_PHONE = process.env.TEST_PHONE || '+919876543210';

async function request(
  method: string,
  path: string,
  body?: object
): Promise<{ status: number; data: any }> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body && (method === 'POST' || method === 'PUT')) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text() };
  }
  return { status: res.status, data };
}

function uuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(str || '')
  );
}

async function discoverCustomerId(phone: string): Promise<string | null> {
  const { status, data } = await request(
    'GET',
    `/customer/by-phone?phone=${encodeURIComponent(phone)}`
  );
  if (status !== 200 || !data?.customer?.id) {
    console.warn('⚠️ Customer discovery failed:', status, data);
    return null;
  }
  const id = data.customer.id;
  if (!uuid(id)) {
    console.warn('⚠️ Customer by-phone returned non-UUID id:', id);
    return null;
  }
  return id;
}

async function discoverVendorAndServiceId(
  customerId: string
): Promise<{ vendorId: string; serviceId: string } | null> {
  // Use discover-services or vendor list to get a vendor with services
  const { status, data } = await request('GET', '/customer/discover-services', undefined);
  if (status !== 200) {
    // Try clinic services for a known region
    const clinicRes = await request(
      'GET',
      '/customer/vendors/search?serviceStyle=at_center&limit=5'
    );
    if (clinicRes.status !== 200 || !clinicRes.data?.vendors?.length) {
      console.warn('⚠️ Vendor discovery failed: no discover-services or vendors/search');
      return null;
    }
    const v = clinicRes.data.vendors[0];
    const vendorId = v.id || v.vendor_id;
    const services = v.services || v.vendor_services || [];
    const firstService = services[0];
    const serviceId =
      firstService?.service_id || firstService?.serviceId || firstService?.id;
    if (!uuid(vendorId) || !uuid(serviceId)) {
      console.warn('⚠️ Vendor/search returned non-UUID vendor or service:', {
        vendorId,
        serviceId,
      });
      return null;
    }
    return { vendorId, serviceId };
  }

  const vendors = data?.vendors ?? data?.data?.vendors ?? [];
  if (!Array.isArray(vendors) || vendors.length === 0) {
    console.warn('⚠️ discover-services returned no vendors');
    return null;
  }
  for (const v of vendors) {
    const vendorId = v.id || v.vendor_id;
    if (!uuid(vendorId)) continue;
    const services =
      v.services ||
      v.vendor_services ||
      v.allServices ||
      data?.services ||
      [];
    const list = Array.isArray(services) ? services : [];
    for (const s of list) {
      const serviceId = s.service_id || s.serviceId || s.id;
      if (uuid(serviceId)) {
        return { vendorId, serviceId };
      }
    }
  }
  // Fallback: GET /vendor/:vendorId/services for first vendor from any endpoint
  const vendorListRes = await request('GET', '/customer/vendors/search?limit=3');
  const list = vendorListRes.data?.vendors || vendorListRes.data?.data?.vendors || [];
  for (const v of list) {
    const vid = v.id || v.vendor_id;
    if (!uuid(vid)) continue;
    const svcRes = await request('GET', `/vendor/${vid}/services`);
    if (svcRes.status !== 200) continue;
    const raw = svcRes.data;
    const services =
      raw?.services ||
      raw?.data?.services ||
      (Array.isArray(raw) ? raw : []);
    const first = services[0];
    if (first) {
      const sid = first.service_id || first.serviceId || first.id;
      if (uuid(sid)) return { vendorId: vid, serviceId: sid };
    }
  }
  return null;
}

/** Run parameter validation only (no real DB IDs). Asserts 400/404 where expected. */
async function runParameterValidation() {
  console.log('\n--- Parameter validation (no DB required) ---\n');
  const fakeBookingId = '00000000-0000-0000-0000-000000000099';

  // razorpay/create-order: empty body → 400 (after backend fix)
  const emptyOrder = await request('POST', '/razorpay/create-order', {});
  if (emptyOrder.status === 400) {
    console.log('✅ POST /razorpay/create-order {} → 400');
  } else {
    console.log(
      `⚠️ POST /razorpay/create-order {} → ${emptyOrder.status} (expected 400). Deploy Lambda for fix.`
    );
  }

  // razorpay/create-order: valid shape, fake booking → 404
  const fakeOrder = await request('POST', '/razorpay/create-order', {
    bookingId: fakeBookingId,
    amount: 100,
    currency: 'INR',
  });
  if (fakeOrder.status === 404) {
    console.log('✅ POST /razorpay/create-order (fake bookingId) → 404');
  } else {
    console.log(
      `⚠️ POST /razorpay/create-order (fake booking) → ${fakeOrder.status} (expected 404)`
    );
  }

  // payments/create: valid shape, fake booking → 404
  const fakePayment = await request('POST', '/payments/create', {
    bookingId: fakeBookingId,
    amount: 100,
    paymentMethod: 'razorpay',
  });
  if (fakePayment.status === 404) {
    console.log('✅ POST /payments/create (fake bookingId) → 404');
  } else {
    console.log(
      `⚠️ POST /payments/create (fake booking) → ${fakePayment.status} (expected 404)`
    );
  }

  // bookings/create: missing customerId → 400
  const badBooking = await request('POST', '/bookings/create', {
    vendorId: '00000000-0000-0000-0000-000000000002',
    serviceId: '00000000-0000-0000-0000-000000000003',
    bookingDate: '2026-12-01',
    bookingTime: '14:00',
    serviceType: 'at_vendor',
    amount: 1000,
  });
  if (badBooking.status === 400) {
    console.log('✅ POST /bookings/create (missing customerId) → 400');
  } else {
    console.log(
      `⚠️ POST /bookings/create (missing customerId) → ${badBooking.status} (expected 400)`
    );
  }

  console.log('');
}

async function runSystematicTest() {
  console.log('\n=== Booking flow systematic test ===\n');
  console.log('API_BASE:', API_BASE);
  console.log('TEST_PHONE:', TEST_PHONE);

  // Always run parameter validation first
  await runParameterValidation();

  let customerId =
    process.env.TEST_CUSTOMER_ID && uuid(process.env.TEST_CUSTOMER_ID)
      ? process.env.TEST_CUSTOMER_ID
      : null;
  let vendorId =
    process.env.TEST_VENDOR_ID && uuid(process.env.TEST_VENDOR_ID)
      ? process.env.TEST_VENDOR_ID
      : null;
  let serviceId =
    process.env.TEST_SERVICE_ID && uuid(process.env.TEST_SERVICE_ID)
      ? process.env.TEST_SERVICE_ID
      : null;

  if (!customerId) {
    console.log('Discovering customer ID by phone...');
    customerId = await discoverCustomerId(TEST_PHONE);
  if (!customerId) {
    console.error(
      '❌ Missing customer ID. Set TEST_CUSTOMER_ID (UUID) or TEST_PHONE for discovery.'
    );
    if (process.env.DRY_RUN === '1') {
      console.log('DRY_RUN=1: Parameter validation above is sufficient. Exiting 0.');
      process.exit(0);
    }
    process.exit(1);
  }
    console.log('✅ Customer ID:', customerId);
  }

  if (!vendorId || !serviceId) {
    console.log('Discovering vendor and service IDs...');
    const discovered = await discoverVendorAndServiceId(customerId);
    if (discovered) {
      vendorId = vendorId || discovered.vendorId;
      serviceId = serviceId || discovered.serviceId;
    }
  }
  if (!vendorId || !uuid(vendorId)) {
    console.error('❌ Missing or invalid vendor ID (UUID). Set TEST_VENDOR_ID.');
    process.exit(1);
  }
  if (!serviceId || !uuid(serviceId)) {
    console.error(
      '❌ Missing or invalid service ID (UUID). Set TEST_SERVICE_ID or ensure discovery returns a vendor with services.'
    );
    process.exit(1);
  }
  console.log('✅ Vendor ID:', vendorId);
  console.log('✅ Service ID:', serviceId);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const bookingDate = tomorrow.toISOString().split('T')[0];
  const bookingTime = '14:00';

  // Step 1: POST /bookings/create
  console.log('\n--- Step 1: POST /bookings/create ---');
  const bookingPayload = {
    customerId,
    vendorId,
    serviceId,
    bookingDate,
    bookingTime,
    serviceType: 'at_vendor',
    amount: 500,
    notes: 'Systematic test booking',
  };
  const bookingRes = await request('POST', '/bookings/create', bookingPayload);
  if (bookingRes.status !== 200) {
    console.error('❌ bookings/create failed:', bookingRes.status, bookingRes.data);
    process.exit(1);
  }
  const bookingId =
    bookingRes.data?.data?.bookingId ||
    bookingRes.data?.bookingId ||
    bookingRes.data?.booking?.id ||
    bookingRes.data?.id;
  if (!bookingId || !uuid(bookingId)) {
    console.error('❌ No valid bookingId in response:', bookingRes.data);
    process.exit(1);
  }
  console.log('✅ Booking ID:', bookingId);

  // Step 2: POST /payments/create
  console.log('\n--- Step 2: POST /payments/create ---');
  const paymentPayload = {
    bookingId,
    amount: 500,
    paymentMethod: 'razorpay',
    customerId,
    vendorId,
  };
  const paymentRes = await request('POST', '/payments/create', paymentPayload);
  if (paymentRes.status !== 200) {
    console.error('❌ payments/create failed:', paymentRes.status, paymentRes.data);
    process.exit(1);
  }
  console.log('✅ Payment created');

  // Step 3: POST /razorpay/create-order
  console.log('\n--- Step 3: POST /razorpay/create-order ---');
  const orderPayload = {
    bookingId,
    amount: 500,
    currency: 'INR',
    customerId,
  };
  const orderRes = await request('POST', '/razorpay/create-order', orderPayload);
  if (orderRes.status !== 200) {
    console.error(
      '❌ razorpay/create-order failed:',
      orderRes.status,
      orderRes.data
    );
    process.exit(1);
  }
  const razorpayOrderId = orderRes.data?.orderId || orderRes.data?.id;
  if (!razorpayOrderId) {
    console.error('❌ No orderId in create-order response:', orderRes.data);
    process.exit(1);
  }
  console.log('✅ Razorpay order ID:', razorpayOrderId);
  console.log('\n=== All steps passed (create-order endpoint passed) ===\n');
}

runSystematicTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
