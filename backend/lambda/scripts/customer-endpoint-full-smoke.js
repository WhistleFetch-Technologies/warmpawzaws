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

/** Minimal valid v2 delivery fee policy (matches backend default shape). */
const SMOKE_DELIVERY_FEE_POLICY = {
  version: 2,
  maxServiceRadiusKm: 10,
  zones: [
    {
      id: 'zone_near',
      name: 'Zone A',
      sortOrder: 0,
      minDistanceKm: 0,
      maxDistanceKm: 5,
      slabs: [
        { minOrderInr: 0, maxOrderInr: 1000, deliveryFeeInr: 99 },
        { minOrderInr: 1000, maxOrderInr: 1500, deliveryFeeInr: 49 },
        { minOrderInr: 1500, maxOrderInr: null, deliveryFeeInr: 0 },
      ],
      surgeConfig: { weekend: true, festival: true, rain: true },
    },
    {
      id: 'zone_mid',
      name: 'Zone B',
      sortOrder: 1,
      minDistanceKm: 5,
      maxDistanceKm: 10,
      slabs: [
        { minOrderInr: 0, maxOrderInr: 1000, deliveryFeeInr: 149 },
        { minOrderInr: 1000, maxOrderInr: 1500, deliveryFeeInr: 99 },
        { minOrderInr: 1500, maxOrderInr: 2000, deliveryFeeInr: 49 },
        { minOrderInr: 2000, maxOrderInr: null, deliveryFeeInr: 0 },
      ],
      surgeConfig: { weekend: true, festival: true, rain: true },
    },
  ],
  surges: {
    weekendInr: 15,
    festivalMinInr: 25,
    festivalMaxInr: 40,
    rainMinInr: 10,
    rainMaxInr: 15,
  },
  runtimeSignals: { festivalActive: false, rainActive: false },
  content: {
    coverageSummary: 'Smoke test delivery policy',
    rulesFreeDelivery: ['Order value meets eligible slab'],
    importantNotes: ['Smoke harness fixture'],
  },
};

function enc(v) {
  return encodeURIComponent(String(v ?? ''));
}

function phoneQuery(fx, extra = '') {
  const phone = fx.customerPhone || fx.queryDefaults?.phone || '';
  const base = phone ? `?phone=${enc(phone)}` : '';
  return extra ? (base ? `${base}&${extra}` : `?${extra}`) : base;
}

function customerBody(fx, fields = {}) {
  return {
    phone: fx.customerPhone,
    customerId: fx.customerId,
    ...fields,
  };
}

const PARAM_MAP = {
  customerId: 'customerId',
  customerid: 'customerId',
  identifier: 'customerPhone',
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
  const phone = fx.customerPhone || fx.queryDefaults?.phone || '';
  const vendorId = fx.vendorId || fx.queryDefaults?.vendorId || '';
  const serviceId = fx.serviceId || fx.itemId || fx.queryDefaults?.serviceId || '';

  if (/resolve-cta/i.test(p)) {
    return '?ctaLink=shop&title=Shop&serviceStyle=at_center';
  }
  if (p === '/customer/profile' && route.method === 'GET') {
    return phoneQuery(fx);
  }
  if (p === '/customer/bookings/active') {
    return phoneQuery(fx);
  }
  if (p === '/customer/addresses' && route.method === 'GET') {
    return phoneQuery(fx);
  }
  if (p === '/customer/pets' && route.method === 'GET') {
    return phoneQuery(fx);
  }
  if (/latest-booking-by-vendor/i.test(p) && vendorId) {
    return `?vendorId=${enc(vendorId)}`;
  }
  if (/pet-matching\/requests$/i.test(p) && fx.customerId) {
    return `?customerId=${enc(fx.customerId)}&type=received`;
  }
  if (/services\/platform/i.test(p)) {
    return '?roleId=vet&serviceStyle=at_center&category=vet';
  }
  if (/vendor-available-slots/i.test(p)) {
    const parts = ['date=2026-07-20', 'serviceStyle=at_home', 'totalDuration=30'];
    if (serviceId) parts.push(`serviceId=${enc(serviceId)}`);
    return `?${parts.join('&')}`;
  }
  if (/discover-services|discovery\/count/i.test(p)) {
    return '?category=vet&serviceStyle=at_center&limit=5';
  }
  if (/services\/by-style/i.test(p)) return '?style=at_center&category=vet';
  if (/customer\/services$/i.test(p)) return '?category=vet&limit=5';
  if (/by-phone|byphone/i.test(p)) return phoneQuery(fx);
  if (/wallet\/transactions/i.test(p)) return phoneQuery(fx, 'limit=5');
  if (/\/bookings$/i.test(p) && !/:bookingId|:phone/.test(p)) return phoneQuery(fx);
  if (/meal-plan-orders/i.test(p)) return phoneQuery(fx);
  if (/radar\/providers/i.test(p)) return '?lat=12.97&lng=77.59&radiusKm=5';
  if (/discover-by-problem/i.test(p)) return '?problem=skin';
  if (/vendors\/search/i.test(p)) return '?q=vet&limit=5';
  if (/autocomplete/i.test(p)) return '?q=vet';
  if (/pricing-quote/i.test(p) && route.method === 'GET') {
    return serviceId ? `?serviceId=${enc(serviceId)}&vendorId=${enc(vendorId)}` : '';
  }
  if (/profile\/unified\/:identifier|profile\/:identifier/i.test(p)) {
    return `?identifier=${enc(phone || fx.customerId || '')}`;
  }
  if (/password-status|passwordstatus/i.test(p)) return phoneQuery(fx);
  if (/payment-methods/i.test(p) && route.method === 'GET') return phoneQuery(fx);
  if (/breeder\/puppies|adoption\/pets$/i.test(p)) return '?limit=5';
  return '';
}

function bodyFor(route, fx) {
  const p = route.path;
  const m = route.method;
  if (m === 'GET' || m === 'DELETE') return null;

  if (/delivery-fee\/calculate/i.test(p)) return { orderSubtotalInr: 500, distanceKm: 3 };
  if (/delivery-fee-policy/i.test(p) && m === 'PUT') return { policy: SMOKE_DELIVERY_FEE_POLICY };

  if (/set-password|setpassword/i.test(p)) {
    return { password: 'TestPass123!', confirmPassword: 'TestPass123!' };
  }
  if (/change-password|account\/password/i.test(p)) {
    return customerBody(fx, {
      currentPassword: 'WrongPass123!',
      newPassword: 'TestPass123!',
      confirmPassword: 'TestPass123!',
    });
  }

  if (p === '/customer/profile' && m === 'POST') {
    return {
      phone: fx.customerPhone,
      profile: {
        firstName: 'Smoke',
        lastName: 'Test',
        pincode: '560001',
        city: 'Bengaluru',
        state: 'KA',
      },
    };
  }

  if (/search[-_]?history/i.test(p) && m === 'POST') {
    return { searchQuery: 'vet grooming', query: 'vet grooming' };
  }
  if (/preferences/i.test(p) && m === 'PUT') {
    return { notificationsEnabled: true, emailNotifications: true };
  }
  if (/preferences/i.test(p) && m === 'POST') {
    return customerBody(fx, { emailNotifications: true, pushNotifications: true });
  }

  if (/addresses/i.test(p) && m === 'POST') {
    const addr = {
      name: 'Smoke Test',
      phone: fx.customerPhone,
      addressLine1: '123 Test Street',
      houseNo: '12A',
      city: 'Bengaluru',
      state: 'KA',
      pincode: '560001',
      latitude: 12.97,
      longitude: 77.59,
      label: 'Home',
    };
    if (/:customerId\/addresses/.test(p)) return addr;
    return customerBody(fx, addr);
  }
  if (/addresses/i.test(p) && (m === 'PUT' || m === 'PATCH')) {
    return {
      label: 'Home',
      addressLine1: '123 Test Street',
      city: 'Bengaluru',
      state: 'KA',
      pincode: '560001',
    };
  }

  if (/orders$/i.test(p) && m === 'POST') {
    return customerBody(fx, { items: [], vendorId: fx.vendorId });
  }
  if (/return/i.test(p)) return { reason: 'smoke-test', items: [] };
  if (/cancel/i.test(p)) return { reason: 'smoke-test' };
  if (/reschedule/i.test(p)) {
    return {
      appointment_date: '2026-08-01',
      appointment_time: '10:00',
      reason: 'smoke-test',
    };
  }

  if (/paymentmethods/i.test(p) && m === 'POST') {
    return customerBody(fx, { type: 'upi', upiId: 'smoke@upi', isDefault: false });
  }
  if (/payments/i.test(p) && m === 'POST') {
    return customerBody(fx, { amount: 100, method: 'upi', upiId: 'smoke@upi' });
  }
  if (/cart/i.test(p) && (m === 'POST' || m === 'PUT')) {
    return { quantity: 1, productId: fx.itemId };
  }
  if (/notifications/i.test(p) && m === 'PUT') {
    return { pushEnabled: true, emailEnabled: true };
  }
  if (/pets/i.test(p) && m === 'POST') {
    const phone = String(fx.customerPhone || '').replace(/\D/g, '');
    const e164 = phone.length === 10 ? `+91${phone}` : phone.startsWith('+') ? phone : `+${phone}`;
    if (p === '/customer/pets' || /\/customer\/pets$/i.test(p)) {
      return {
        phone: e164,
        pets: [{ name: 'SmokePet', type: 'Dog', breed: 'mixed', gender: 'Male' }],
      };
    }
    return {
      name: 'SmokePet',
      species: 'dog',
      breed: 'mixed',
      gender: 'male',
      age_years: 2,
    };
  }
  if (/onboarding\/complete/i.test(p)) return { completed: true, journeyType: 'standard' };
  if (/questionnaire\/planning/i.test(p)) {
    return customerBody(fx, { answers: { lifestyle: 'active' } });
  }
  if (/pricing\/quote/i.test(p) && m === 'POST') {
    return {
      serviceId: fx.serviceId || fx.itemId,
      vendorId: fx.vendorId,
      petId: fx.petId,
    };
  }
  if (/vendor-facility/i.test(p) && m === 'PUT') return { description: 'smoke' };
  if (/vendor-facility-upload|facility.*upload/i.test(p)) {
    return { imageUrl: 'https://example.com/smoke.jpg' };
  }
  if (/diagnostics-approve-vendor/i.test(p)) {
    return customerBody(fx, { approved: true, vendorId: fx.vendorId });
  }
  if (/adoption\/questionnaire/i.test(p)) {
    return customerBody(fx, {
      customerPhone: fx.customerPhone,
      petId: fx.petId,
      experience: 'some',
      livingSituation: 'apartment',
      reason: 'smoke',
    });
  }
  if (/adoption\/request/i.test(p)) {
    return customerBody(fx, { petId: fx.petId, message: 'smoke adoption request' });
  }
  if (/relocation\/book/i.test(p)) {
    return customerBody(fx, {
      fromCity: 'Bengaluru',
      toCity: 'Mumbai',
      petCount: 1,
      serviceId: fx.serviceId || fx.itemId,
    });
  }
  if (/relocation\/quote/i.test(p)) {
    return {
      fromCity: 'Bengaluru',
      toCity: 'Mumbai',
      petCount: 1,
      petSize: 'medium',
    };
  }
  if (/breeder\/inquiry/i.test(p)) {
    return customerBody(fx, { puppyId: fx.petId, message: 'smoke inquiry' });
  }
  if (/breeder\/reserve/i.test(p)) {
    return customerBody(fx, { puppyId: fx.petId, depositInr: 500 });
  }
  if (/petmatching\/request/i.test(p)) {
    return customerBody(fx, { petId: fx.petId, targetPetId: fx.petId, notes: 'smoke' });
  }
  if (/petmatching\/requests/i.test(p) && m === 'PUT') {
    return { status: 'declined', message: 'smoke' };
  }
  if (/holidays\/build-package/i.test(p)) {
    return {
      startDate: '2026-08-01',
      endDate: '2026-08-05',
      petId: fx.petId,
      vendorId: fx.vendorId,
    };
  }
  if (/adoption-applications/i.test(p) && m === 'PUT') {
    return { status: 'reviewed', notes: 'smoke' };
  }
  if (/respond/i.test(p)) return { accepted: false, message: 'smoke' };
  return customerBody(fx);
}

function authHeaders(route, fx) {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (fx.authToken) h.Authorization = `Bearer ${fx.authToken}`;
  if (fx.customerId) h['x-user-id'] = fx.customerId;
  if (fx.customerPhone) h['x-user-phone'] = fx.customerPhone;
  if (process.env.UAT_MODE === 'true' || fx.uatMode) h['x-uat-mode'] = 'true';
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
        serviceId: '00000000-0000-0000-0000-000000000099',
        authToken: null,
        queryDefaults: {
          phone: '9845299005',
          customerPhone: '9845299005',
          roleId: 'vet',
          serviceStyle: 'at_center',
          category: 'vet',
        },
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
