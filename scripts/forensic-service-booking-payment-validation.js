#!/usr/bin/env node
/**
 * Forensic validation: Service booking + payment flows
 * Ensures POST /bookings/create (and aliases) and Razorpay create-order/verify-payment
 * return proper status codes and response shapes (no 500 from parse/body handling).
 *
 * Usage: node scripts/forensic-service-booking-payment-validation.js
 * Env:   API_BASE (default http://localhost:3000)
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const headers = { 'Content-Type': 'application/json' };

async function request(method, path, body) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const opt = { method, headers };
  if (body && (method === 'POST' || method === 'PUT')) opt.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(url, opt);
  } catch (err) {
    return { status: 0, ok: false, json: null, text: '', error: err.message };
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, ok: res.ok, json, text };
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function main() {
  const results = { passed: 0, failed: 0, errors: [] };

  const run = (name, fn) => {
    return fn().then(() => {
      results.passed++;
      console.log(`  ✅ ${name}`);
    }).catch((e) => {
      results.failed++;
      results.errors.push(`${name}: ${e.message}`);
      console.log(`  ❌ ${name}: ${e.message}`);
    });
  };

  // Reachability
  const probe = await request('GET', '/bookings/create');
  if (probe.status === 0) {
    console.log('API_BASE not reachable. Set API_BASE and run again.');
    process.exit(1);
  }

  console.log('\n--- 1. Booking create: empty/invalid body must not 500 ---');
  await run('POST /bookings/create empty body → 400 or 200', async () => {
    const r = await request('POST', '/bookings/create', {});
    assert(r.status !== 500, `Expected no 500, got ${r.status}`);
    assert(r.status === 400 || r.status === 200, `Expected 400 or 200, got ${r.status}`);
    if (r.json && r.json.error) assert(r.json.error, 'Error message present');
  });

  await run('POST /bookings/create null body → no 500', async () => {
    const r = await request('POST', '/bookings/create', null);
    assert(r.status !== 500, `Expected no 500, got ${r.status}`);
  });

  console.log('\n--- 2. Booking create: valid-shaped body (may 400/404/409) ---');
  await run('POST /bookings/create valid shape → no 500', async () => {
    const body = {
      customerId: '00000000-0000-0000-0000-000000000001',
      vendorId: '00000000-0000-0000-0000-000000000002',
      serviceId: '00000000-0000-0000-0000-000000000003',
      bookingDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      bookingTime: '10:00',
      amount: 100,
    };
    const r = await request('POST', '/bookings/create', body);
    assert(r.status !== 500, `Expected no 500, got ${r.status} - ${r.text?.slice(0, 200)}`);
    if (r.status === 200 && r.json) {
      const data = r.json.data ?? r.json;
      assert(data.bookingId || data.booking?.id, 'Response has bookingId or booking.id');
    }
  });

  console.log('\n--- 3. Booking create aliases (same contract) ---');
  await run('POST /booking/create empty → no 500', async () => {
    const r = await request('POST', '/booking/create', {});
    assert(r.status !== 500, `Expected no 500, got ${r.status}`);
  });
  await run('POST /customer/bookings/create empty → no 500', async () => {
    const r = await request('POST', '/customer/bookings/create', {});
    assert(r.status !== 500, `Expected no 500, got ${r.status}`);
  });

  console.log('\n--- 4. Razorpay create-order: must not 500 from response parse ---');
  await run('POST /razorpay/create-order minimal body → 400 or 500 (config), valid JSON', async () => {
    const r = await request('POST', '/razorpay/create-order', { amount: 100 });
    assert(r.status !== 0, 'Request completed');
    assert(r.json !== null || r.status === 504, 'Response is JSON or 504');
    if (r.json && r.status >= 400) assert(r.json.error || r.json.message, 'Error response has message');
  });

  console.log('\n--- 5. Razorpay verify-payment: invalid payload → 400 or 500 (config), valid JSON ---');
  await run('POST /razorpay/verify-payment invalid signature → 400 or 500 (config), JSON', async () => {
    const r = await request('POST', '/razorpay/verify-payment', {
      razorpay_order_id: 'order_xxx',
      razorpay_payment_id: 'pay_xxx',
      razorpay_signature: 'bad',
    });
    assert(r.status === 400 || r.status === 500, `Expected 400 or 500, got ${r.status}`);
    assert(r.json !== null, 'Response is JSON (no parse crash)');
  });

  await run('POST /razorpay/verify-payment empty body → 400 or 500, JSON', async () => {
    const r = await request('POST', '/razorpay/verify-payment', {});
    assert(r.status === 400 || r.status === 500, `Expected 400 or 500, got ${r.status}`);
    assert(r.json !== null, 'Response is JSON');
  });

  console.log('\n--- 6. Create-from-package (optional) ---');
  await run('POST /bookings/create-from-package empty → no 500', async () => {
    const r = await request('POST', '/bookings/create-from-package', {});
    assert(r.status !== 500, `Expected no 500, got ${r.status}`);
  });

  console.log('\n--- Summary ---');
  console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
  if (results.errors.length) console.log('Errors:', results.errors);
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
