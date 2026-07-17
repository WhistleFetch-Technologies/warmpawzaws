#!/usr/bin/env node
/**
 * Behavioral parity compare for hot-path customer routes.
 * Compares local responses against dev API baseline (shape + status semantics).
 *
 * Usage:
 *   node scripts/customer-endpoint-parity-compare.js --local http://localhost:3000 --baseline https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
 */
const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, '_customer-smoke-fixtures.json');
const OUT = path.join(__dirname, '_customer-parity-results.json');

const args = process.argv.slice(2);
const LOCAL =
  (args.includes('--local') ? args[args.indexOf('--local') + 1] : null) ||
  process.env.SMOKE_BASE_URL ||
  'http://localhost:3000';
const BASELINE =
  (args.includes('--baseline') ? args[args.indexOf('--baseline') + 1] : null) ||
  process.env.SMOKE_BASELINE_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const HOT_PATHS = [
  { method: 'GET', path: '/customer/discovery/meta' },
  { method: 'GET', path: '/customer/discovery/count?category=vet&serviceStyle=at_center' },
  { method: 'GET', path: '/customer/discover-services?category=vet&serviceStyle=at_center&limit=5' },
  { method: 'GET', path: '/customer/services/by-style?style=at_center&category=vet' },
  { method: 'GET', path: '/customer/delivery-fee-policy' },
  {
    method: 'POST',
    path: '/customer/delivery-fee/calculate',
    body: { orderSubtotalInr: 500, distanceKm: 3 },
  },
  { method: 'GET', path: '/customer/banners' },
  { method: 'GET', path: '/customer/articles?limit=3' },
  { method: 'GET', path: '/customer/announcements' },
  { method: 'GET', path: '/customer/featured-vendors' },
  { method: 'GET', path: '/customer/vendors/search?q=vet&limit=5' },
  { method: 'GET', path: '/customer/discover-by-problem?problem=skin&category=vet' },
  { method: 'GET', path: '/customer/password-status' },
  { method: 'GET', path: '/customer/profile/password-status' },
  { method: 'GET', path: '/customer/account/status' },
  { method: 'GET', path: '/customer/wallet' },
  { method: 'GET', path: '/customer/payment-methods' },
  { method: 'GET', path: '/customer/bookings/active' },
  { method: 'GET', path: '/customer/orders' },
  { method: 'GET', path: '/customer/appointments' },
  { method: 'GET', path: '/customer/pets' },
  { method: 'GET', path: '/customer/notifications' },
  { method: 'GET', path: '/customer/saved' },
  { method: 'GET', path: '/customer/cart' },
  { method: 'GET', path: '/customer/wallet/transactions?limit=5' },
  { method: 'GET', path: '/customer/meal-plan-orders' },
  { method: 'GET', path: '/customer/diagnostic-packages' },
  { method: 'GET', path: '/customer/featured-packages' },
  { method: 'GET', path: '/customer/content-pages/about' },
  { method: 'GET', path: '/customer/relocation/services' },
];

const IGNORE_KEYS = new Set([
  'timestamp',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
  'access_token',
  'accessToken',
  'token',
  'requestId',
  'traceId',
]);

function topKeys(obj, prefix = '', acc = new Set()) {
  if (obj == null || typeof obj !== 'object') return acc;
  if (Array.isArray(obj)) {
    if (obj[0] && typeof obj[0] === 'object') topKeys(obj[0], prefix, acc);
    return acc;
  }
  for (const k of Object.keys(obj)) {
    if (IGNORE_KEYS.has(k)) continue;
    const full = prefix ? `${prefix}.${k}` : k;
    acc.add(full);
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      topKeys(obj[k], full, acc);
    }
  }
  return acc;
}

function substitute(pathStr, fx) {
  let p = pathStr;
  if (!fx) return p;
  const map = {
    customerId: fx.customerId,
    phone: fx.customerPhone,
    vendorId: fx.vendorId,
    bookingId: fx.bookingId,
    orderId: fx.orderId,
  };
  for (const [k, v] of Object.entries(map)) {
    if (v) p = p.replace(new RegExp(`:${k}`, 'gi'), String(v));
  }
  if (fx.customerPhone && /phone/.test(p) && !p.includes('?')) {
    // phone routes use fixture phone in path segments elsewhere
  }
  return p;
}

function headers(fx, base) {
  const h = { 'Content-Type': 'application/json' };
  if (fx?.authToken) h.Authorization = `Bearer ${fx.authToken}`;
  if (fx?.customerId) h['x-user-id'] = fx.customerId;
  if (fx?.customerPhone) h['x-user-phone'] = fx.customerPhone;
  return h;
}

async function fetchOne(base, spec, fx) {
  const pathStr = substitute(spec.path, fx);
  const url = `${base.replace(/\/$/, '')}${pathStr}`;
  const opts = { method: spec.method, headers: headers(fx, base) };
  if (spec.body) opts.body = JSON.stringify(spec.body);
  const res = await fetch(url, opts);
  let data = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function main() {
  const fx = fs.existsSync(FIXTURES) ? JSON.parse(fs.readFileSync(FIXTURES, 'utf8')) : null;
  const results = [];
  let drift = 0;

  console.log(`Parity compare: local=${LOCAL} baseline=${BASELINE}\n`);

  for (const spec of HOT_PATHS) {
    const [local, baseline] = await Promise.all([
      fetchOne(LOCAL, spec, fx),
      fetchOne(BASELINE, spec, fx),
    ]);

    const localKeys = topKeys(local.data);
    const baseKeys = topKeys(baseline.data);
    const missing = [...baseKeys].filter((k) => !localKeys.has(k));
    const added = [...localKeys].filter((k) => !baseKeys.has(k));
    const statusMatch =
      local.status === baseline.status ||
      (local.status === 200 && baseline.status === 200) ||
      (local.status === 401 && baseline.status === 401);

    const ok = statusMatch && missing.length === 0;
    if (!ok) drift++;

    results.push({
      method: spec.method,
      path: spec.path,
      localStatus: local.status,
      baselineStatus: baseline.status,
      statusMatch,
      missingKeys: missing.slice(0, 10),
      addedKeys: added.slice(0, 10),
      ok,
    });

    const mark = ok ? 'OK' : 'DRIFT';
    console.log(
      `[${mark}] ${spec.method} ${spec.path} local=${local.status} baseline=${baseline.status}` +
        (missing.length ? ` missing=[${missing.slice(0, 3).join(', ')}]` : '')
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    local: LOCAL,
    baseline: BASELINE,
    total: results.length,
    drift,
    passRate: Math.round(((results.length - drift) / results.length) * 1000) / 10,
    results,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\n${results.length - drift}/${results.length} parity OK`);
  process.exit(drift === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
