#!/usr/bin/env node
/**
 * Smoke-test customer endpoint split on local Lambda (serverless offline).
 * Usage:
 *   node scripts/customer-endpoint-split-smoke.js
 *   node scripts/customer-endpoint-split-smoke.js --base http://localhost:3000 --phase 1
 *
 * Requires: backend running via `cd backend/lambda && npm run start:local`
 */
const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:3000';

const phase = process.argv.includes('--phase')
  ? parseInt(process.argv[process.argv.indexOf('--phase') + 1], 10)
  : 1;

const tests = {
  1: [
    { name: 'GET /customer/delivery-fee-policy', method: 'GET', path: '/customer/delivery-fee-policy', expectStatus: [200, 500] },
    {
      name: 'POST /customer/delivery-fee/calculate',
      method: 'POST',
      path: '/customer/delivery-fee/calculate',
      body: { orderSubtotalInr: 500, distanceKm: 3 },
      expectStatus: [200, 500],
    },
    { name: 'GET /customer/password-status (no auth)', method: 'GET', path: '/customer/password-status', expectStatus: [401] },
  ],
  2: [
    { name: 'GET /customer/discovery/meta', method: 'GET', path: '/customer/discovery/meta', expectStatus: [200] },
    { name: 'GET /customer/discovery/count', method: 'GET', path: '/customer/discovery/count?category=vet&serviceStyle=at_center', expectStatus: [200] },
    { name: 'GET /customer/discover-services', method: 'GET', path: '/customer/discover-services?category=vet&serviceStyle=at_center&limit=5', expectStatus: [200] },
    { name: 'GET /customer/services/by-style', method: 'GET', path: '/customer/services/by-style?style=at_center&category=vet', expectStatus: [200] },
  ],
};

async function runOne(t) {
  const url = `${BASE.replace(/\/$/, '')}${t.path}`;
  const opts = { method: t.method, headers: { 'Content-Type': 'application/json' } };
  if (t.body) opts.body = JSON.stringify(t.body);
  const res = await fetch(url, opts);
  const ok = (t.expectStatus || [200]).includes(res.status);
  let snippet = '';
  try {
    const text = await res.text();
    snippet = text.slice(0, 120);
  } catch {
    snippet = '';
  }
  return { ...t, status: res.status, ok, snippet };
}

async function main() {
  const suite = tests[phase];
  if (!suite) {
    console.error(`Unknown phase ${phase}`);
    process.exit(1);
  }
  console.log(`Customer endpoint split smoke — phase ${phase} — ${BASE}\n`);
  let failed = 0;
  for (const t of suite) {
    try {
      const r = await runOne(t);
      const mark = r.ok ? 'OK' : 'FAIL';
      if (!r.ok) failed++;
      console.log(`[${mark}] ${r.name} → HTTP ${r.status}`);
      if (!r.ok) console.log(`       body: ${r.snippet}`);
    } catch (e) {
      failed++;
      console.log(`[FAIL] ${t.name} → ${e.message}`);
      console.log('       Is local API running? cd backend/lambda && npm run start:local');
    }
  }
  console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
