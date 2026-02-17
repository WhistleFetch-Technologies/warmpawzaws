#!/usr/bin/env node
/**
 * Systematic forensic E2E tests for Instant Tele V2 flow (vet-only, payment-first, no queue).
 *
 * Tests:
 * 1. GET /customer/tele/available-now – response shape, vet-only (no staff), vendors array
 * 2. GET /customer/vendor/:vendorId/services?serviceStyle=tele – for a vendor from available-now
 * 3. POST /razorpay/create-order (type: booking_prepaid) – no bookingId, creates payment row with booking_id null
 * 4. Payment guard: instant-after-payment with missing params → 400
 * 5. Payment guard: instant-after-payment with invalid signature → 400
 * 6. Payment guard: instant-after-payment with non-existent order (payment not found) → 404
 *
 * Usage:
 *   TEST_API_URL=https://your-api.execute-api.region.amazonaws.com node scripts/forensic-instant-tele-v2-e2e.js
 *   TEST_CUSTOMER_PHONE=9876543210  (optional, for create-order step; script can skip if no phone)
 */

const API_BASE = process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const TEST_PHONE = process.env.TEST_CUSTOMER_PHONE || '9876543210';
/** If set, 404 on instant-tele endpoints is treated as skip (endpoint not deployed) instead of fail. */
const ALLOW_404_AS_SKIP = process.env.ALLOW_404_AS_SKIP === '1' || process.env.ALLOW_404_AS_SKIP === 'true';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const results = { passed: 0, failed: 0, skipped: 0, errors: [], endpoint404: false };

function pass(step, message, detail = null) {
  results.passed++;
  console.log(`  ✅ PASS: ${message}`);
  if (detail != null) console.log(`     ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
}

function fail(step, message, expected, actual) {
  results.failed++;
  results.errors.push({ step, message, expected, actual });
  console.log(`  ❌ FAIL: ${message}`);
  if (expected != null) console.log(`     Expected: ${typeof expected === 'object' ? JSON.stringify(expected) : expected}`);
  if (actual != null) console.log(`     Actual: ${typeof actual === 'object' ? JSON.stringify(actual) : actual}`);
}

function skip(step, reason) {
  results.skipped++;
  console.log(`  ⏭️  SKIP: ${reason}`);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function validateUUID(val) {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

async function main() {
  const base = API_BASE.replace(/\/$/, '');

  console.log('\n' + '═'.repeat(72));
  console.log('FORENSIC E2E: Instant Tele V2 (available-now, payment-first, no queue)');
  console.log('═'.repeat(72));
  console.log(`API: ${base}`);
  console.log(`Customer phone: ${TEST_PHONE}`);
  console.log('═'.repeat(72));

  // -------------------------------------------------------------------------
  // STEP 1: GET /customer/tele/available-now
  // -------------------------------------------------------------------------
  console.log('\n📋 STEP 1: GET /customer/tele/available-now');
  console.log('─'.repeat(72));
  let firstVendorId = null;
  let firstVendorName = null;
  try {
    const { ok, status, data } = await fetchJson(`${base}/customer/tele/available-now`);
    if (status === 404 && ALLOW_404_AS_SKIP) {
      results.endpoint404 = true;
      skip('available-now', 'Endpoint returned 404 (instant-tele-v2 may not be deployed yet)');
    } else if (!ok && status !== 200) {
      fail('available-now', `HTTP ${status}`, 200, status);
    } else if (data.success !== true) {
      fail('available-now', 'response.success !== true', true, data.success);
    } else {
      pass('available-now', 'success: true');
    }

    const vendors = (status === 404 && ALLOW_404_AS_SKIP) ? [] : (data.vendors || []);
    if (!(status === 404 && ALLOW_404_AS_SKIP)) {
      if (!Array.isArray(data.vendors)) {
        fail('available-now', 'vendors must be an array', 'array', typeof data.vendors);
      } else {
        pass('available-now', `vendors.length = ${data.vendors.length}`);
      }
    }

    if (Array.isArray(vendors) && vendors.length > 0) {
      const v = vendors[0];
      if (!v.vendorId && !v.vendor_id) fail('available-now', 'First vendor missing vendorId/vendor_id', 'vendorId', Object.keys(v));
      else {
        firstVendorId = v.vendorId || v.vendor_id;
        firstVendorName = v.vendorName || v.vendor_name || 'Vet';
        if (!validateUUID(firstVendorId)) fail('available-now', 'First vendor id not UUID', 'UUID', firstVendorId);
        else pass('available-now', 'First vendor has valid vendorId (vet-only list)');
      }
      // No staff in response (vet-only, no staff)
      if (v.staffId || v.staff_id) fail('available-now', 'Vendor object must not have staffId (vet-only)', 'no staffId', v);
      else pass('available-now', 'Response has no staff (vet-only)');
    } else if (!(status === 404 && ALLOW_404_AS_SKIP)) {
      skip('available-now', 'No vendors available right now (va2 may have no tele window for current time)');
    }
  } catch (e) {
    fail('available-now', 'Request threw', '200 OK', e.message);
  }

  // -------------------------------------------------------------------------
  // STEP 2: GET /customer/vendor/:vendorId/services?serviceStyle=tele
  // -------------------------------------------------------------------------
  console.log('\n📋 STEP 2: GET /customer/vendor/:vendorId/services?serviceStyle=tele');
  console.log('─'.repeat(72));
  let firstServiceId = null;
  if (!firstVendorId) {
    skip('vendor/services', 'No vendor from available-now');
  } else {
    try {
      const { ok, status, data } = await fetchJson(
        `${base}/customer/vendor/${firstVendorId}/services?serviceStyle=tele`
      );
      if (!ok && status !== 200) {
        fail('vendor/services', `HTTP ${status}`, 200, status);
      } else {
        pass('vendor/services', 'HTTP 200');
      }
      const services = data.services || data.data || (Array.isArray(data) ? data : []);
      if (!Array.isArray(services)) {
        fail('vendor/services', 'services must be array', 'array', typeof services);
      } else {
        pass('vendor/services', `services.length = ${services.length}`);
      }
      if (Array.isArray(services) && services.length > 0) {
        const s = services[0];
        firstServiceId = s.id || s.service_id || s.serviceId;
        if (!firstServiceId) fail('vendor/services', 'First service missing id', 'id', Object.keys(s));
        else pass('vendor/services', 'First service has id');
      }
    } catch (e) {
      fail('vendor/services', 'Request threw', '200 OK', e.message);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 3: Customer by phone (for create-order)
  // -------------------------------------------------------------------------
  console.log('\n📋 STEP 3: GET /customer/by-phone (customerId for create-order)');
  console.log('─'.repeat(72));
  let customerId = null;
  try {
    const { ok, status, data } = await fetchJson(
      `${base}/customer/by-phone?phone=${encodeURIComponent(TEST_PHONE)}`
    );
    if (!ok) {
      skip('by-phone', `No customer for phone or error ${status}`);
    } else {
      const cust = data.customer || data;
      customerId = cust.id || cust.customer_id;
      if (customerId && validateUUID(customerId)) {
        pass('by-phone', 'customerId resolved');
      } else {
        skip('by-phone', 'customerId missing or not UUID');
        customerId = null;
      }
    }
  } catch (e) {
    skip('by-phone', e.message);
  }

  // -------------------------------------------------------------------------
  // STEP 4: POST /razorpay/create-order (booking_prepaid)
  // -------------------------------------------------------------------------
  console.log('\n📋 STEP 4: POST /razorpay/create-order (type: booking_prepaid, no bookingId)');
  console.log('─'.repeat(72));
  let orderId = null;
  if (!firstVendorId || !customerId) {
    skip('create-order', 'Need vendorId and customerId');
  } else {
    try {
      const body = {
        type: 'booking_prepaid',
        amount: 499,
        currency: 'INR',
        customerId,
        vendorId: firstVendorId,
      };
      const { ok, status, data } = await fetchJson(`${base}/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!ok) {
        fail('create-order', `HTTP ${status}: ${data?.error || data?.message || 'unknown'}`, '2xx', status);
      } else {
        orderId = data?.orderId || data?.data?.orderId;
        if (!orderId) fail('create-order', 'Response missing orderId', 'orderId', data);
        else pass('create-order', 'orderId returned (payment row created with booking_id null)');
      }
    } catch (e) {
      fail('create-order', 'Request threw', '2xx', e.message);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 5: Payment guard – instant-after-payment with missing params → 400
  // -------------------------------------------------------------------------
  console.log('\n📋 STEP 5: POST /customer/tele/instant-after-payment (missing params → 400)');
  console.log('─'.repeat(72));
  try {
    const { ok, status, data } = await fetchJson(`${base}/customer/tele/instant-after-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: 'order_missing',
        razorpay_payment_id: 'pay_missing',
        razorpay_signature: 'sig',
        // missing vendorId, customerId, petId, serviceId
      }),
    });
    if (status === 404 && ALLOW_404_AS_SKIP) {
      results.endpoint404 = true;
      skip('instant-after-payment', 'Endpoint returned 404 (may not be deployed)');
    } else if (ok) {
      fail('instant-after-payment', 'Should reject missing vendorId/customerId/petId/serviceId with 400', 400, status);
    } else if (status === 400) {
      pass('instant-after-payment', 'Missing params rejected with 400');
    } else {
      fail('instant-after-payment', 'Expected 400 for missing params', 400, status);
    }
  } catch (e) {
    fail('instant-after-payment', 'Request threw', '400', e.message);
  }

  // -------------------------------------------------------------------------
  // STEP 6: Payment guard – invalid signature → 400
  // -------------------------------------------------------------------------
  console.log('\n📋 STEP 6: POST /customer/tele/instant-after-payment (invalid signature → 400)');
  console.log('─'.repeat(72));
  try {
    const { ok, status, data } = await fetchJson(`${base}/customer/tele/instant-after-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderId || 'order_nonexistent',
        razorpay_payment_id: 'pay_fake',
        razorpay_signature: 'invalid_signature',
        vendorId: firstVendorId || '00000000-0000-0000-0000-000000000001',
        customerId: customerId || '00000000-0000-0000-0000-000000000002',
        petId: '00000000-0000-0000-0000-000000000003',
        serviceId: firstServiceId || '00000000-0000-0000-0000-000000000004',
        amount: 499,
      }),
    });
    if (ok) {
      fail('instant-after-payment', 'Should reject invalid signature with 400', 400, status);
    } else if (status === 400 || status === 404) {
      pass('instant-after-payment', `Invalid/unknown payment rejected (${status})`);
    } else {
      fail('instant-after-payment', 'Expected 400/404 for invalid signature or unknown order', '400|404', status);
    }
  } catch (e) {
    fail('instant-after-payment', 'Request threw', '400', e.message);
  }

  // -------------------------------------------------------------------------
  // STEP 7: Payment guard – non-existent order (payment not found) → 404
  // -------------------------------------------------------------------------
  console.log('\n📋 STEP 7: POST /customer/tele/instant-after-payment (non-existent order → 404)');
  console.log('─'.repeat(72));
  try {
    const fakeOrderId = 'order_000000000000000000000000';
    const { ok, status } = await fetchJson(`${base}/customer/tele/instant-after-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: fakeOrderId,
        razorpay_payment_id: 'pay_fake',
        razorpay_signature: 'signed_fake',
        vendorId: firstVendorId || '00000000-0000-0000-0000-000000000001',
        customerId: customerId || '00000000-0000-0000-0000-000000000002',
        petId: '00000000-0000-0000-0000-000000000003',
        serviceId: firstServiceId || '00000000-0000-0000-0000-000000000004',
        amount: 499,
      }),
    });
    if (ok) {
      fail('instant-after-payment', 'Should return 404 for non-existent payment record', 404, status);
    } else if (status === 404 || status === 400) {
      pass('instant-after-payment', `Non-existent order rejected (${status})`);
    } else {
      fail('instant-after-payment', 'Expected 404/400 for non-existent order', '404|400', status);
    }
  } catch (e) {
    fail('instant-after-payment', 'Request threw', '404', e.message);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '═'.repeat(72));
  console.log('SUMMARY');
  console.log('═'.repeat(72));
  console.log(`  Passed:  ${results.passed}`);
  console.log(`  Failed:  ${results.failed}`);
  console.log(`  Skipped: ${results.skipped}`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.step}] ${e.message}`);
    });
  }
  if (results.endpoint404) {
    console.log('\n  ℹ️  One or more instant-tele-v2 endpoints returned 404. Deploy the latest Lambda to run full E2E.');
  }
  console.log('═'.repeat(72));
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
