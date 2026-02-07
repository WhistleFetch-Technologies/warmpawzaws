#!/usr/bin/env node
/**
 * Systematic programmatic API tests against deployed Lambda.
 * Covers: health, previous-providers (phone resolution), problem-grid,
 * specializations, customer/bookings (category alias).
 *
 * Usage:
 *   API_BASE_URL=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com node scripts/run-systematic-api-tests.js
 */

const https = require('https');

const API_BASE = process.env.API_BASE_URL || process.env.API_ENDPOINT || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers: { Accept: 'application/json' },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

const tests = [];
function add(name, fn) {
  tests.push({ name, run: fn });
}

add('GET /health', async () => {
  const res = await request('/health');
  if (res.statusCode !== 200) throw new Error(`expected 200, got ${res.statusCode}`);
  if (res.body && res.body.ok === undefined && res.body.status !== 'ok' && !res.body.message) {
    // some health endpoints return { message: 'ok' } or similar
  }
  return 'OK';
});

add('GET /customer/:phone/previous-providers (phone resolution)', async () => {
  const res = await request('/customer/9611377119/previous-providers?serviceType=grooming');
  if (res.statusCode !== 200) throw new Error(`expected 200, got ${res.statusCode} - ${JSON.stringify(res.body)}`);
  if (res.body.success !== true) throw new Error('expected success: true');
  if (!Array.isArray(res.body.providers)) throw new Error('expected providers array');
  return `OK (providers: ${res.body.providers.length})`;
});

add('GET /public/problem-grid', async () => {
  const res = await request('/public/problem-grid');
  if (res.statusCode !== 200) throw new Error(`expected 200, got ${res.statusCode}`);
  if (!Array.isArray(res.body.problems)) throw new Error('expected problems array');
  const grooming = (res.body.problems || []).filter(p => p.categoryId === 'grooming');
  const hairTrim = (res.body.problems || []).find(p => p.id === 'hair_trim' || p.name === 'Hair Trim');
  return `OK (problems: ${res.body.problems.length}, grooming: ${grooming.length}${hairTrim ? ', hair_trim: yes' : ''})`;
});

add('GET /public/problem-grid/:roleId (groomer)', async () => {
  const res = await request('/public/problem-grid/groomer');
  if (res.statusCode !== 200) throw new Error(`expected 200, got ${res.statusCode}`);
  if (!Array.isArray(res.body.problems)) throw new Error('expected problems array');
  return `OK (problems: ${res.body.problems.length})`;
});

add('GET /vendor/specializations/:roleId (groomer)', async () => {
  const res = await request('/vendor/specializations/groomer');
  if (res.statusCode !== 200) throw new Error(`expected 200, got ${res.statusCode}`);
  if (!Array.isArray(res.body.specializations)) throw new Error('expected specializations array');
  const hairTrim = (res.body.specializations || []).find(s => s.id === 'hair_trim' || (s.name && s.name.toLowerCase().includes('hair')));
  return `OK (specializations: ${res.body.specializations.length}${hairTrim ? ', hair trim: yes' : ''})`;
});

add('GET /customer/bookings?phone=...&category=vet (category alias)', async () => {
  const res = await request('/customer/bookings?phone=9611377119&category=vet');
  if (res.statusCode !== 200 && res.statusCode !== 404) throw new Error(`expected 200 or 404, got ${res.statusCode}`);
  if (res.statusCode === 404 && res.body.error && res.body.error.includes('Customer not found')) return 'OK (no customer - 404 expected)';
  if (res.statusCode === 200 && Array.isArray(res.body.bookings) !== true && res.body.bookings === undefined) {
    if (res.body.error) throw new Error(res.body.error);
  }
  return `OK (${res.statusCode})`;
});

add('GET /customer/notifications/:phone', async () => {
  const res = await request('/customer/notifications/9611377119?limit=10');
  if (res.statusCode !== 200) throw new Error(`expected 200, got ${res.statusCode}`);
  return `OK (notifications: ${Array.isArray(res.body.notifications) ? res.body.notifications.length : (res.body.data?.length ?? 0)})`;
});

async function main() {
  console.log('Systematic API Tests');
  console.log('====================');
  console.log('API:', API_BASE);
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const { name, run } of tests) {
    try {
      const result = await run();
      console.log('✅', name, '-', result);
      passed++;
    } catch (e) {
      console.log('❌', name, '-', e.message);
      failed++;
    }
  }

  console.log('');
  console.log('---');
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
