#!/usr/bin/env node
/**
 * Full smoke test for all customer routes (manifest-driven).
 * Usage:
 *   node scripts/customer-endpoint-full-smoke.js --base http://localhost:3000
 *   node scripts/customer-endpoint-full-smoke.js --base http://localhost:3000 --batch 10
 */
const fs = require('fs');
const path = require('path');

const MANIFEST = path.join(__dirname, '_customer-route-manifest.json');
const FIXTURES = path.join(__dirname, '_customer-smoke-fixtures.json');
const OUT = path.join(__dirname, '_customer-smoke-results.json');

const args = process.argv.slice(2);
const BASE =
  (args.includes('--base') ? args[args.indexOf('--base') + 1] : null) ||
  process.env.SMOKE_BASE_URL ||
  'http://localhost:3000';
const BATCH = parseInt(
  args.includes('--batch') ? args[args.indexOf('--batch') + 1] : process.env.SMOKE_BATCH || '10',
  10
);
const RETRY_ONCE = !args.includes('--no-retry');

const PARAM_MAP = {
  customerId: 'customerId',
  customerid: 'customerId',
  phone: 'customerPhone',
  bookingId: 'bookingId',
  bookingid: 'bookingId',
  orderId: 'orderId',
  orderid: 'orderId',
  appointmentId: 'appointmentId',
  appointmentid: 'appointmentId',
  vendorId: 'vendorId',
  vendorid: 'vendorId',
  addressId: 'addressId',
  addressid: 'addressId',
  petId: 'petId',
  petid: 'petId',
  itemId: 'itemId',
  itemid: 'itemId',
  paymentId: 'paymentId',
  paymentid: 'paymentId',
  requestId: 'requestId',
  requestid: 'requestId',
  quoteId: 'quoteId',
  quoteid: 'quoteId',
  applicationId: 'applicationId',
  applicationid: 'applicationId',
  methodId: 'paymentId',
  methodid: 'paymentId',
  slug: 'slug',
  id: 'bookingId',
};

function substitutePath(routePath, fx) {
  let p = routePath;
  for (const [param, key] of Object.entries(PARAM_MAP)) {
    const val = fx[key] || fx.queryDefaults?.[key] || fx.queryDefaults?.[param];
    if (val) p = p.replace(new RegExp(`:${param}\\b`, 'gi'), String(val));
  }
  return p;
}

function queryFor(route, fx) {
  const p = route.path;
  if (/discover-services|discovery\/count/i.test(p)) {
    return '?category=vet&serviceStyle=at_center&limit=5';
  }
  if (/services\/by-style/i.test(p)) return '?style=at_center&category=vet';
  if (/services\/platform/i.test(p)) return '?category=vet&serviceStyle=at_center';
  if (/customer\/services$/i.test(p)) return '?category=vet&limit=5';
  if (/by-phone|byphone/i.test(p)) return `?phone=${encodeURIComponent(fx.customerPhone || '')}`;
  if (/wallet/i.test(p) && /phone/.test(p)) return `?phone=${encodeURIComponent(fx.customerPhone || '')}`;
  if (/bookings\?/i.test(p) || (/\/bookings$/i.test(p) && !/:bookingId/.test(p))) {
    return `?phone=${encodeURIComponent(fx.customerPhone || '')}`;
  }
  if (/meal-plan-orders/i.test(p)) return `?phone=${encodeURIComponent(fx.customerPhone || '')}`;
  if (/radar-providers|radar\/providers/i.test(p)) return '?lat=12.97&lng=77.59&radiusKm=5';
  if (/discover-by-problem/i.test(p)) return '?problem=skin';
  if (/vendors\/search/i.test(p)) return '?q=vet&limit=5';
  if (/radar-providers/i.test(p)) return '?lat=12.97&lng=77.59&radiusKm=5';
  if (/autocomplete/i.test(p)) return '?q=vet';
  if (/pricing-quote/i.test(p)) return '?serviceId=00000000-0000-0000-0000-000000000099';
  if (/vendor-available-slots/i.test(p)) return '?date=2026-07-20';
  if (/public-vendor-profile|customer-vendor-profile/i.test(p)) return '';
  if (/banners\/resolvecta/i.test(p)) return '?cta=shop';
  if (/articles\/[^/]+$/i.test(p)) return '';
  if (/content-pages/i.test(p)) return '';
  if (/identifier/i.test(p)) return '?identifier=9845299005';
  if (/password-status|passwordstatus/i.test(p)) return '';
  if (/wallet\/transactions/i.test(p)) return `?phone=${encodeURIComponent(fx.customerPhone || '')}&limit=5`;
  if (/bookings\/active/i.test(p) && /:phone/.test(p)) return '';
  if (/activewalks|upcomingcalls/i.test(p)) return '';
  if (/followupeligible/i.test(p)) return '';
  if (/paymentresume/i.test(p)) return '';
  if (/invoice/i.test(p)) return '';
  if (/pharmacystatus/i.test(p)) return '';
  if (/breeder_puppies|adoption_pets/i.test(p)) return '?limit=5';
  if (/relocation_services/i.test(p)) return '';
  return '';
}

function bodyFor(route, fx) {
  const p = route.path;
  const m = route.method;
  if (m === 'GET' || m === 'DELETE') return null;

  if (/delivery-fee\/calculate/i.test(p)) return { orderSubtotalInr: 500, distanceKm: 3 };
  if (/delivery-fee-policy/i.test(p) && m === 'PUT') return { baseFeeInr: 40, perKmInr: 10 };
  if (/set-password|setpassword/i.test(p)) return { password: 'TestPass123!' };
  if (/profile$/i.test(p) && m === 'POST') return { name: 'Smoke Test', phone: fx.customerPhone };
  if (/searchhistory/i.test(p) && m === 'POST') return { query: 'vet', category: 'vet' };
  if (/preferences/i.test(p) && m === 'PUT') return { notificationsEnabled: true };
  if (/addresses/i.test(p) && m === 'POST') {
    return {
      label: 'Home',
      line1: '123 Test St',
      city: 'Bengaluru',
      state: 'KA',
      pincode: '560001',
      latitude: 12.97,
      longitude: 77.59,
    };
  }
  if (/addresses/i.test(p) && (m === 'PUT' || m === 'PATCH')) {
    return { label: 'Home', line1: '123 Test St', city: 'Bengaluru' };
  }
  if (/orders$/i.test(p) && m === 'POST') return { items: [], vendorId: fx.vendorId };
  if (/return/i.test(p)) return { reason: 'smoke-test', items: [] };
  if (/cancel/i.test(p)) return { reason: 'smoke-test' };
  if (/reschedule/i.test(p)) return { newDate: '2026-08-01', newTime: '10:00' };
  if (/paymentmethods/i.test(p) && m === 'POST') return { type: 'upi', upiId: 'test@upi' };
  if (/payments/i.test(p) && m === 'POST') return { amount: 100, method: 'upi' };
  if (/cart/i.test(p) && (m === 'POST' || m === 'PUT')) return { quantity: 1, productId: fx.itemId };
  if (/notifications/i.test(p) && m === 'PUT') return { pushEnabled: true };
  if (/pets/i.test(p) && m === 'POST') return { name: 'SmokePet', species: 'dog', breed: 'mixed' };
  if (/onboarding\/complete/i.test(p)) return { completed: true };
  if (/preferences/i.test(p) && m === 'POST') return { emailNotifications: true };
  if (/pricing-quote/i.test(p)) return { serviceId: fx.itemId, vendorId: fx.vendorId };
  if (/vendor-facility/i.test(p) && m === 'PUT') return { description: 'smoke' };
  if (/vendor-facility-upload/i.test(p)) return { imageUrl: 'https://example.com/x.jpg' };
  if (/diagnostics-approve-vendor/i.test(p)) return { approved: true };
  if (/adoption/i.test(p)) return { petId: fx.petId, message: 'smoke' };
  if (/relocation/i.test(p)) return { fromCity: 'Bengaluru', toCity: 'Mumbai', petCount: 1 };
  if (/breeder_inquiry/i.test(p)) return { message: 'smoke inquiry' };
  if (/petmatching/i.test(p)) return { petId: fx.petId, notes: 'smoke' };
  if (/holidays\/buildpackage/i.test(p)) return { startDate: '2026-08-01', endDate: '2026-08-05' };
  if (/account\/password/i.test(p)) return { currentPassword: 'x', newPassword: 'TestPass123!' };
  if (/respond/i.test(p)) return { accepted: false, message: 'smoke' };
  return {};
}

function authHeaders(route, fx) {
  const h = { 'Content-Type': 'application/json' };
  if (fx.authToken) h.Authorization = `Bearer ${fx.authToken}`;
  if (fx.customerId) h['x-user-id'] = fx.customerId;
  if (route.needsAuth || /customer\/|profile|password|wallet|cart|orders|appointments|bookings|payments|notifications|saved|paymentmethods|pets/i.test(route.path)) {
    if (fx.customerPhone) h['x-user-phone'] = fx.customerPhone;
  }
  return h;
}

async function fetchRoute(route, fx) {
  const pathStr = substitutePath(route.path, fx) + queryFor(route, fx);
  const url = `${BASE.replace(/\/$/, '')}${pathStr}`;
  const body = bodyFor(route, fx);
  const opts = { method: route.method, headers: authHeaders(route, fx) };
  if (body !== null && route.method !== 'GET' && route.method !== 'DELETE') {
    opts.body = JSON.stringify(body);
  }
  const t0 = Date.now();
  const res = await fetch(url, opts);
  const latencyMs = Date.now() - t0;
  let json = null;
  let raw = '';
  try {
    raw = await res.text();
    if (raw) json = JSON.parse(raw);
  } catch {
    json = raw || null;
  }
  const ok = res.status === 200 && json != null && json !== '';
  return {
    id: route.id,
    module: route.module,
    method: route.method,
    path: route.path,
    url,
    status: res.status,
    latencyMs,
    ok,
    bodyNull: json == null || json === '',
    error: ok ? null : `status=${res.status}`,
  };
}

async function fetchWithRetry(route, fx) {
  let r = await fetchRoute(route, fx);
  if (!r.ok && RETRY_ONCE && (r.status >= 500 || r.status === 0)) {
    await new Promise((res) => setTimeout(res, 500));
    r = await fetchRoute(route, fx);
    r.retried = true;
  }
  return r;
}

async function runBatch(routes, fx) {
  const results = [];
  for (let i = 0; i < routes.length; i += BATCH) {
    const chunk = routes.slice(i, i + BATCH);
    const chunkResults = await Promise.all(chunk.map((r) => fetchWithRetry(r, fx)));
    results.push(...chunkResults);
    for (const r of chunkResults) {
      const mark = r.ok ? 'OK' : 'FAIL';
      console.log(`[${mark}] ${r.method} ${r.path} → ${r.status} (${r.latencyMs}ms)`);
    }
  }
  return results;
}

async function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('Run generate-customer-route-manifest.js first');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const fx = fs.existsSync(FIXTURES)
    ? JSON.parse(fs.readFileSync(FIXTURES, 'utf8'))
    : {
        customerPhone: '9845299005',
        customerId: '00000000-0000-0000-0000-000000000001',
        bookingId: '00000000-0000-0000-0000-000000000002',
        orderId: '00000000-0000-0000-0000-000000000003',
        vendorId: '00000000-0000-0000-0000-000000000004',
        addressId: '00000000-0000-0000-0000-000000000005',
        petId: '00000000-0000-0000-0000-000000000006',
        itemId: '00000000-0000-0000-0000-000000000007',
        paymentId: '00000000-0000-0000-0000-000000000008',
        slug: 'about',
        authToken: null,
      };

  console.log(`Customer full smoke — ${manifest.routes.length} routes — ${BASE}\n`);
  const results = await runBatch(manifest.routes, fx);
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    total: results.length,
    passed,
    failed: failed.length,
    passRate: results.length ? Math.round((passed / results.length) * 1000) / 10 : 0,
    results,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\n${passed}/${results.length} passed (${report.passRate}%)`);
  console.log(`Report: ${OUT}`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed.slice(0, 20)) {
      console.log(`  ${f.method} ${f.path} → ${f.status}`);
    }
    if (failed.length > 20) console.log(`  ... and ${failed.length - 20} more`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
