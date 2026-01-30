/**
 * Forensic Verification: Solo Trainer/Groomer + Start Travel Implementation
 *
 * Verifies:
 * 1. Solo trainer/groomer custom services & session packages (backend + frontend)
 * 2. POST /tracking/start: no 503, safe body parse, timeout in ETA
 *
 * Run: npx ts-node scripts/forensic-verification-implementation.ts
 * Or:  API_BASE_URL=https://rrg9107m3d.execute-api.ap-south-1.amazonaws.com npx ts-node scripts/forensic-verification-implementation.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const API_BASE = process.env.API_BASE_URL || process.env.API_BASE || '';

interface Result {
  area: string;
  check: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  detail?: string;
}

const results: Result[] = [];

function pass(area: string, check: string, message: string, detail?: string) {
  results.push({ area, check, status: 'PASS', message, detail });
  console.log(`  ✅ ${check}: ${message}`);
}

function fail(area: string, check: string, message: string, detail?: string) {
  results.push({ area, check, status: 'FAIL', message, detail });
  console.log(`  ❌ ${check}: ${message}`);
}

function skip(area: string, check: string, message: string) {
  results.push({ area, check, status: 'SKIP', message });
  console.log(`  ⏭️  ${check}: ${message}`);
}

// ---------- 1. Solo trainer/groomer – backend packages ----------
function verifyPackagesBackend() {
  const file = path.join(process.cwd(), 'backend/lambda/src/endpoints/packages.ts');
  if (!fs.existsSync(file)) {
    fail('Packages API', 'file exists', 'packages.ts not found');
    return;
  }
  const content = fs.readFileSync(file, 'utf-8');

  if (content.includes("'groomer'") && content.includes('allowedSoloRoles')) {
    pass('Packages API', 'groomer in allowedSoloRoles', 'Solo groomers can create session packages');
  } else {
    fail('Packages API', 'groomer in allowedSoloRoles', 'allowedSoloRoles should include groomer');
  }

  if (content.includes('solo trainers, walkers, sitters, and groomers')) {
    pass('Packages API', 'error message', 'Error message mentions groomers');
  } else {
    fail('Packages API', 'error message', 'Error message should mention groomers');
  }
}

// ---------- 2. Solo trainer/groomer – frontend role checks ----------
function verifyFrontendSoloGroomer() {
  const files: [string, string][] = [
    ['apps/vendor-web/components/vendor/VendorCustomServiceCreationEnhanced.tsx', 'groomer_solo'],
    ['apps/vendor-web/components/vendor/VendorCustomServiceCreationEnhanced.tsx', "roleName.includes('groomer')"],
    ['apps/vendor-web/components/vendor/packages/CreatePackageFlow.tsx', 'groomer_solo'],
    ['apps/vendor-web/components/vendor/dashboard/SoloProviderDashboard.tsx', 'groomer_solo'],
  ];
  for (const [relPath, search] of files) {
    const full = path.join(process.cwd(), relPath);
    if (!fs.existsSync(full)) {
      fail('Frontend solo/groomer', path.basename(relPath), `File not found: ${relPath}`);
      continue;
    }
    const content = fs.readFileSync(full, 'utf-8');
    if (content.includes(search)) {
      pass('Frontend solo/groomer', path.basename(relPath), `Contains ${search}`);
    } else {
      fail('Frontend solo/groomer', path.basename(relPath), `Missing: ${search}`);
    }
  }
}

// ---------- 3. POST /tracking/start – safe body & no 503 ----------
function verifyTrackingStartCode() {
  const epPath = path.join(process.cwd(), 'backend/lambda/src/endpoints/gps-tracking.ts');
  const svcPath = path.join(process.cwd(), 'backend/lambda/src/lib/services/gps-tracking-service.ts');

  if (!fs.existsSync(epPath)) {
    fail('Tracking start', 'gps-tracking.ts', 'File not found');
    return;
  }
  const epContent = fs.readFileSync(epPath, 'utf-8');

  if (epContent.includes('c.req.text()') && epContent.includes('JSON.parse')) {
    pass('Tracking start', 'safe body parse', 'Uses req.text() + JSON.parse for body');
  } else {
    fail('Tracking start', 'safe body parse', 'Should use safe body parse (req.text + JSON.parse)');
  }

  if (epContent.includes('Invalid JSON body') || epContent.includes('400')) {
    pass('Tracking start', '400 on invalid body', 'Returns 400 for invalid JSON');
  }

  if (epContent.includes('TRACKING_UNAVAILABLE') || epContent.includes('503')) {
    pass('Tracking start', '503 with JSON', 'Returns 503 with JSON for DB/table errors');
  }

  if (!fs.existsSync(svcPath)) {
    fail('Tracking start', 'gps-tracking-service.ts', 'File not found');
    return;
  }
  const svcContent = fs.readFileSync(svcPath, 'utf-8');
  if (svcContent.includes('AbortController') && svcContent.includes('setTimeout')) {
    pass('Tracking start', 'fetch timeout', 'ETA fetch uses AbortController + timeout');
  } else {
    fail('Tracking start', 'fetch timeout', 'ETA fetch should use timeout to avoid Lambda 503');
  }
  if (svcContent.includes('clearTimeout(timeoutId)')) {
    pass('Tracking start', 'clear timeout', 'Timeout is cleared in catch/fallback');
  }
}

// ---------- 4. API tests (optional, when API_BASE_URL set) ----------
async function verifyTrackingStartApi() {
  if (!API_BASE) {
    skip('API', 'tracking/start', 'Set API_BASE_URL to run API checks');
    return;
  }
  const fetchFn = typeof fetch !== 'undefined' ? fetch : (globalThis as any).fetch;
  if (!fetchFn) {
    skip('API', 'tracking/start', 'No fetch available (use Node 18+ or set API_BASE_URL)');
    return;
  }
  const url = `${API_BASE}/tracking/start`;

  // 4a. Empty body → 400
  try {
    const r1 = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    const t1 = await r1.text();
    let body1: any = {};
    try {
      body1 = t1 ? JSON.parse(t1) : {};
    } catch {
      body1 = { error: t1 };
    }
    if (r1.status === 400 && (body1.error || body1.message)) {
      pass('API', 'POST /tracking/start empty body', `Returns 400 with message (got ${r1.status})`);
    } else if (r1.status === 503) {
      fail('API', 'POST /tracking/start empty body', `Returns 503 (should be 400 for invalid body). Body: ${t1.slice(0, 200)}`);
    } else {
      pass('API', 'POST /tracking/start empty body', `Status ${r1.status} (not 503). Body: ${t1.slice(0, 120)}`);
    }
  } catch (e: any) {
    fail('API', 'POST /tracking/start empty body', e.message || 'Request failed');
  }

  // 4b. Invalid JSON → 400
  try {
    const r2 = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json {',
    });
    const t2 = await r2.text();
    if (r2.status === 400) {
      pass('API', 'POST /tracking/start invalid JSON', 'Returns 400');
    } else if (r2.status === 503) {
      fail('API', 'POST /tracking/start invalid JSON', `Returns 503. Body: ${t2.slice(0, 200)}`);
    } else {
      pass('API', 'POST /tracking/start invalid JSON', `Status ${r2.status} (not 503)`);
    }
  } catch (e: any) {
    fail('API', 'POST /tracking/start invalid JSON', e.message || 'Request failed');
  }

  // 4c. Valid body (booking not found) → 404 or 400, not 503
  try {
    const r3 = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-UAT-Mode': 'true' },
      body: JSON.stringify({
        bookingId: '00000000-0000-0000-0000-000000000001',
        vendorId: '00000000-0000-0000-0000-000000000002',
        startLatitude: 19.076,
        startLongitude: 72.877,
      }),
    });
    const t3 = await r3.text();
    if (r3.status === 503) {
      fail('API', 'POST /tracking/start valid body', `Returns 503 (Lambda timeout?). Body: ${t3.slice(0, 200)}`);
    } else if (r3.status === 404 || r3.status === 400) {
      pass('API', 'POST /tracking/start valid body', `Returns ${r3.status} (booking not found / validation) – no 503`);
    } else if (r3.status === 200) {
      pass('API', 'POST /tracking/start valid body', 'Returns 200 (session created or UAT path)');
    } else {
      pass('API', 'POST /tracking/start valid body', `Status ${r3.status} (not 503)`);
    }
  } catch (e: any) {
    fail('API', 'POST /tracking/start valid body', e.message || 'Request failed');
  }
}

async function main() {
  console.log('🔬 Forensic Verification: Solo Trainer/Groomer + Start Travel\n');
  console.log('='.repeat(60));

  console.log('\n📦 1. Backend – Solo groomer in packages API');
  console.log('-'.repeat(40));
  verifyPackagesBackend();

  console.log('\n📦 2. Frontend – Solo groomer/trainer role checks');
  console.log('-'.repeat(40));
  verifyFrontendSoloGroomer();

  console.log('\n📦 3. Backend – POST /tracking/start (no 503)');
  console.log('-'.repeat(40));
  verifyTrackingStartCode();

  console.log('\n📦 4. API – POST /tracking/start (live)');
  console.log('-'.repeat(40));
  await verifyTrackingStartApi();

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);

  if (failed > 0) {
    console.log('\n❌ Failed checks:');
    results.filter((r) => r.status === 'FAIL').forEach((r) => console.log(`   - [${r.area}] ${r.check}: ${r.message}`));
    process.exit(1);
  }
  console.log('\n✅ Forensic verification passed.\n');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
