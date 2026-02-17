#!/usr/bin/env node
/**
 * Systematic API testing via HTTP: trace flows and detect 5xx/gaps.
 * Exit 1 if any request returns 5xx.
 *
 * Usage:
 *   API_BASE=https://... node scripts/forensic-api-curl-trace.js
 *   TEST_VENDOR_ID=<uuid> node scripts/forensic-api-curl-trace.js   # test vendor support with existing vendor
 *
 * Expected 400 (validation) and 404 (vendor not found when no TEST_VENDOR_ID) are treated as success.
 * Only existing vendors have the support chat; without TEST_VENDOR_ID we assert 404 for POST /vendor/support/tickets.
 */

const API_BASE = process.env.API_BASE || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const headers = { 'Content-Type': 'application/json' };

async function req(method, path, body = undefined) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const opt = { method, headers };
  if (body !== undefined && (method === 'POST' || method === 'PUT')) {
    opt.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const start = Date.now();
  let res;
  try {
    res = await fetch(url, opt);
  } catch (e) {
    return { status: 0, ms: Date.now() - start, body: null, error: e.message };
  }
  const text = await res.text();
  let bodyParsed = null;
  try { bodyParsed = JSON.parse(text); } catch { bodyParsed = text; }
  return { status: res.status, ms: Date.now() - start, body: bodyParsed, text };
}

function ok(r, minStatus = 200, maxStatus = 299) {
  return r.status >= minStatus && r.status <= maxStatus;
}

function errStr(body) {
  if (!body || typeof body !== 'object') return '';
  const e = body.error;
  if (e == null) return '';
  return typeof e === 'string' ? e : JSON.stringify(e);
}

/**
 * @param {string} name - Label
 * @param {{ status: number, ms: number, body: any, error?: string }} r - Response
 * @param {boolean} expectNo500 - If false, 5xx does not count as failed
 * @param {number|number[]} expectedStatus - When status matches (e.g. 400 or 404), treat as success ✅
 */
function trace(name, r, expectNo500 = true, expectedStatus = null) {
  const bad = expectNo500 && r.status >= 500;
  const expected = expectedStatus != null && (Array.isArray(expectedStatus) ? expectedStatus.includes(r.status) : r.status === expectedStatus);
  const symbol = bad ? '❌' : expected || (r.status >= 200 && r.status < 300) ? '✅' : '⚠️';
  console.log(`  ${symbol} ${name} → ${r.status} (${r.ms}ms)`);
  if (r.error) console.log(`      error: ${r.error}`);
  if (!expected) {
    const err = errStr(r.body);
    if (err) console.log(`      body.error: ${err}`);
  }
  return { name, status: r.status, ms: r.ms, body: r.body, failed: bad };
}

async function main() {
  console.log('\n=== Systematic API trace ===');
  console.log('API_BASE:', API_BASE);
  const results = [];

  // --- 1. Booking create (empty/invalid → expect 400) ---
  console.log('\n--- 1. Booking create ---');
  let r = await req('POST', '/bookings/create', {});
  results.push(trace('POST /bookings/create {} (validation)', r, true, 400));
  r = await req('POST', '/bookings/create', {
    customerId: '00000000-0000-0000-0000-000000000001',
    vendorId: '00000000-0000-0000-0000-000000000002',
    serviceId: '00000000-0000-0000-0000-000000000003',
    bookingDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    bookingTime: '10:00',
    amount: 100,
  });
  results.push(trace('POST /bookings/create valid-shape (validation)', r, true, 400));

  r = await req('POST', '/booking/create', {});
  results.push(trace('POST /booking/create {} (validation)', r, true, 400));

  r = await req('POST', '/customer/bookings/create', {});
  results.push(trace('POST /customer/bookings/create {} (validation)', r, true, 400));

  r = await req('POST', '/bookings/create-from-package', {});
  results.push(trace('POST /bookings/create-from-package {} (validation)', r, true, 400));

  // --- 2. Razorpay (missing/invalid → expect 400) ---
  console.log('\n--- 2. Razorpay ---');
  r = await req('POST', '/razorpay/create-order', { amount: 100 });
  results.push(trace('POST /razorpay/create-order missing bookingId (validation)', r, true, 400));

  r = await req('POST', '/razorpay/verify-payment', {
    razorpay_order_id: 'order_xxx',
    razorpay_payment_id: 'pay_xxx',
    razorpay_signature: 'bad',
  });
  results.push(trace('POST /razorpay/verify-payment invalid signature (validation)', r, true, 400));

  // --- 3. AI Chatbot ---
  console.log('\n--- 3. AI Chatbot ---');
  r = await req('POST', '/ai-chatbot/chat', { message: 'Hello' });
  results.push(trace('POST /ai-chatbot/chat {message}', r));
  if (r.status === 200 && r.body && typeof r.body === 'object') {
    if (r.body.response) console.log('      response (trim):', String(r.body.response).slice(0, 80) + '...');
    if (r.body.error) console.log('      error:', r.body.error);
  }

  r = await req('POST', '/ai-chatbot/chat', { message: 'Hi', userType: 'vendor', vendorId: '00000000-0000-0000-0000-000000000002' });
  results.push(trace('POST /ai-chatbot/chat vendor', r));

  r = await req('POST', '/ai-chatbot/chat', {});
  results.push(trace('POST /ai-chatbot/chat {} (validation)', r, true, 400));

  r = await req('POST', '/ai-chatbot/symptoms-checker', { symptoms: 'dog not eating' });
  results.push(trace('POST /ai-chatbot/symptoms-checker', r));

  r = await req('POST', '/ai-chatbot/symptoms-checker', {});
  results.push(trace('POST /ai-chatbot/symptoms-checker {} (validation)', r, true, 400));

  r = await req('POST', '/ai-chatbot/booking-assist', { query: 'how to book a vet' });
  results.push(trace('POST /ai-chatbot/booking-assist', r));

  r = await req('POST', '/ai-chatbot/escalate-to-agent', { conversationId: 'conv-test-123', vendorId: '00000000-0000-0000-0000-000000000002', reason: 'test' });
  results.push(trace('POST /ai-chatbot/escalate-to-agent vendor', r));

  // --- 4. Support / CRM ---
  console.log('\n--- 4. Support & CRM ---');
  r = await req('GET', '/support/tickets?limit=2');
  results.push(trace('GET /support/tickets', r));

  r = await req('GET', '/crm/tickets?limit=2');
  results.push(trace('GET /crm/tickets', r));

  r = await req('POST', '/support/tickets', { subject: 'Trace test', message: 'API trace test ticket' });
  results.push(trace('POST /support/tickets', r));

  // --- 5. Vendor support (only existing vendors have support chat; use TEST_VENDOR_ID for real vendor) ---
  console.log('\n--- 5. Vendor support ---');
  const testVendorId = process.env.TEST_VENDOR_ID || null;
  if (testVendorId) {
    r = await req('POST', '/vendor/support/tickets', {
      vendorId: testVendorId,
      subject: 'Trace test vendor',
      description: 'API trace vendor ticket',
    });
    results.push(trace('POST /vendor/support/tickets (existing vendor)', r));
    r = await req('GET', `/vendor/support/tickets?vendorId=${testVendorId}&limit=2`);
    results.push(trace('GET /vendor/support/tickets', r));
  } else {
    r = await req('POST', '/vendor/support/tickets', {
      vendorId: '00000000-0000-0000-0000-000000000002',
      subject: 'Trace test vendor',
      description: 'API trace vendor ticket',
    });
    results.push(trace('POST /vendor/support/tickets no vendor (expect 404)', r, true, 404));
    r = await req('GET', '/vendor/support/tickets?vendorId=00000000-0000-0000-0000-000000000002&limit=2');
    results.push(trace('GET /vendor/support/tickets', r));
  }

  // --- Summary ---
  const failed = results.filter((x) => x.failed);
  const fiveHundred = results.filter((x) => x.status >= 500);
  console.log('\n--- Summary ---');
  console.log('Total:', results.length, '| 5xx:', fiveHundred.length, '| Failed (expectNo500):', failed.length);
  if (fiveHundred.length) {
    console.log('5xx requests:');
    fiveHundred.forEach((x) => console.log('  -', x.name, '→', x.status));
  }
  process.exit(fiveHundred.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
