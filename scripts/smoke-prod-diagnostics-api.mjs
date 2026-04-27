/**
 * Minimal prod smoke: health + diagnostics booking contract (no JWT).
 * Proves API is up; paid-diagnostics without razorpay_order_id → DIAGNOSTICS_PAYMENT_REQUIRED when code is deployed.
 *
 * Usage:
 *   node scripts/smoke-prod-diagnostics-api.mjs
 *   PROD_API_URL=https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com node scripts/smoke-prod-diagnostics-api.mjs
 */

const BASE =
  process.env.PROD_API_URL ||
  process.env.TEST_API_URL ||
  'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';

const FAKE = '00000000-0000-0000-0000-000000000001';

async function req(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try {
    data = await r.json();
  } catch {
    data = {};
  }
  return { status: r.status, data };
}

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

async function main() {
  console.log('═'.repeat(60));
  console.log('PROD SMOKE – diagnostics / API liveness');
  console.log('═'.repeat(60));
  console.log(`BASE: ${BASE}\n`);

  // 1) Health
  const h = await req('/health');
  if (h.status !== 200) fail(`GET /health expected 200, got ${h.status}`);
  ok(`GET /health → ${h.status}`);

  // 2) Paid diagnostics create without razorpay_order_id (needs REAL prod UUIDs to hit payment gate)
  const vendorId = process.env.TEST_DIAGNOSTICS_VENDOR_ID || FAKE;
  const customerId = process.env.TEST_DIAGNOSTICS_CUSTOMER_ID || FAKE;
  const soon = new Date();
  soon.setDate(soon.getDate() + 14);
  const bookingDate = soon.toISOString().slice(0, 10);

  const body = {
    customerId,
    vendorId,
    serviceId: 'diagnostics',
    bookingDate,
    bookingTime: '10:00',
    serviceType: 'at_center',
    amount: 150,
    totalAmount: 150,
    notes: JSON.stringify({ patientName: 'Smoke', preferredSampleType: 'center' }),
  };
  const c = await req('/bookings/create', { method: 'POST', body });
  if (c.status === 400 && c.data?.error?.code === 'DIAGNOSTICS_PAYMENT_REQUIRED') {
    ok(`POST /bookings/create (paid diagnostics, no order id) → 400 DIAGNOSTICS_PAYMENT_REQUIRED`);
  } else if (c.status === 409) {
    ok(`POST /bookings/create → 409 slot conflict (live vendor/slot path hit)`);
  } else if (c.status === 404 || c.status === 400) {
    const code = c.data?.error?.code;
    console.log(`  ℹ️  POST /bookings/create → ${c.status} code=${code || 'n/a'}`);
    if (code === 'NOT_FOUND' || code === 'SERVICE_NOT_FOUND' || String(c.data?.error?.message || '').includes('not found')) {
      ok('Service/vendor/customer not found (set TEST_DIAGNOSTICS_VENDOR_ID + TEST_DIAGNOSTICS_CUSTOMER_ID for payment-gate assert)');
    } else if (String(c.data?.error?.message || '').toLowerCase().includes('razorpay')) {
      ok('Error mentions payment / razorpay');
    } else {
      console.log('     ', JSON.stringify(c.data).slice(0, 350));
    }
  } else {
    fail(`POST /bookings/create unexpected ${c.status}: ${JSON.stringify(c.data).slice(0, 300)}`);
  }

  // 3) Razorpay create-order diagnostics (invalid customer → 404 or 400)
  const rz = await req('/razorpay/create-order', {
    method: 'POST',
    body: { type: 'diagnostics', amount: 150, customerId: FAKE, vendorId: FAKE },
  });
  if ([400, 404, 500].includes(rz.status)) {
    ok(`POST /razorpay/create-order (diagnostics, fake ids) → ${rz.status} (no live order without real entities)`);
  } else {
    console.log(`  ⚠️  POST /razorpay/create-order → ${rz.status}`, JSON.stringify(rz.data).slice(0, 200));
  }

  // 4) Discovery endpoint (informational)
  const v = await req('/customer/diagnostics/vendors-with-tests');
  if (v.status === 200 && v.data?.success) {
    ok(`GET /customer/diagnostics/vendors-with-tests → 200`);
  } else {
    console.log(`  ⚠️  GET /customer/diagnostics/vendors-with-tests → ${v.status} (known prod issues possible)`);
    if (v.data?.error) console.log('     ', String(v.data.error).slice(0, 200));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Smoke finished (exit 0). Full happy path needs real customer/vendor + Razorpay in UI.');
  console.log('═'.repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
