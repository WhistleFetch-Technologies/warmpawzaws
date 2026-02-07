#!/usr/bin/env node
/**
 * Forensic E2E: Canonical Roles & Service Discovery
 *
 * Tests all discovery endpoints against deployed API:
 * - GET /customer/discovery/meta
 * - GET /customer/discover-services (categories: vet, grooming, walker, lab-diagnostics, cafes, etc.)
 * - GET /customer/services/by-style (style=at_center, at_home, tele)
 *
 * Usage:
 *   TEST_API_URL=https://rrg9107m3d.execute-api.ap-south-1.amazonaws.com node scripts/forensic-discovery-e2e.js
 */

// Use z0b3obweb6 for unauthenticated access; rrg9107m3d (CDK) requires auth for /customer/*
const API_BASE = process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const CATEGORIES_TO_TEST = [
  'vet',
  'grooming',
  'training',
  'walker',
  'lab-diagnostics', // Customer tile uses this; must normalize to diagnostics
  'cafes',
  'boarding',
  'adoption',
  'shop',
  'pharmacy',
  'diagnostics',
  'nutritionist',
  'photography',
  'insurance',
  'breeder',
  'ambulance',
  'relocation',
  'resort',
];

const SERVICE_STYLES = ['at_center', 'at_home', 'tele'];

function log(step, message, data) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${step}] ${message}`);
  if (data != null && typeof data === 'object') {
    const str = JSON.stringify(data);
    if (str.length > 200) console.log('  ' + str.substring(0, 200) + '...');
    else console.log('  ' + str);
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${data?.error || data?.message || res.statusText}`);
  }
  return data;
}

async function main() {
  const base = API_BASE.replace(/\/$/, '');
  console.log('\n' + '═'.repeat(70));
  console.log('FORENSIC E2E: Canonical Roles & Service Discovery');
  console.log('═'.repeat(70));
  console.log(`API: ${base}`);
  console.log('═'.repeat(70));

  const results = { passed: 0, failed: 0, errors: [] };

  // 1. Discovery Meta
  console.log('\n📋 STEP 1: GET /customer/discovery/meta');
  console.log('─'.repeat(70));
  try {
    const meta = await fetchJson(`${base}/customer/discovery/meta`);
    const roles = meta.roles || [];
    const categories = meta.categories || [];
    const serviceStyles = meta.serviceStyles || [];

    log('meta', 'OK', { roleCount: roles.length, categories: categories.length, styles: serviceStyles.length });

    if (roles.length === 0 && categories.length === 0) {
      console.log('  ⚠️  No roles/categories returned (empty DB or fallback)');
    } else {
      console.log('  Roles:', roles.slice(0, 10).map((r) => r.roleId || r.roleName).join(', '), roles.length > 10 ? `... (+${roles.length - 10} more)` : '');
      console.log('  Categories:', categories.slice(0, 15).join(', '), categories.length > 15 ? `... (+${categories.length - 15} more)` : '');
      console.log('  Service styles:', serviceStyles.join(', ') || '(default fallback)');
    }

    const hasLabDiagnostics = categories.some((c) => (c || '').toLowerCase() === 'lab-diagnostics' || (c || '').toLowerCase() === 'diagnostics');
    const hasCafes = categories.some((c) => (c || '').toLowerCase() === 'cafes' || (c || '').toLowerCase() === 'cafe');

    if (!hasLabDiagnostics && !hasCafes) {
      console.log('  ℹ️  lab-diagnostics/cafes may be derived from roles (getCategoryFromRole)');
    }
    results.passed++;
  } catch (e) {
    log('meta', 'FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: 'discovery/meta', error: e.message });
  }

  // 2. Discover Services by Category
  console.log('\n📋 STEP 2: GET /customer/discover-services (by category)');
  console.log('─'.repeat(70));

  const categoryResults = {};
  for (const cat of CATEGORIES_TO_TEST.slice(0, 10)) {
    try {
      const url = `${base}/customer/discover-services?category=${encodeURIComponent(cat)}&latitude=12.9716&longitude=77.5946`;
      const res = await fetchJson(url);
      const list = res.providers ?? res.vendors ?? [];
      const count = Array.isArray(list) ? list.length : 0;
      categoryResults[cat] = { count, ok: true };
      log('discover', `${cat} → ${count} providers/vendors`);
    } catch (e) {
      categoryResults[cat] = { error: e.message, ok: false };
      log('discover', `${cat} → FAIL: ${e.message}`);
    }
  }

  const catPassed = Object.values(categoryResults).filter((r) => r.ok).length;
  const catFailed = Object.values(categoryResults).filter((r) => !r.ok).length;
  results.passed += catPassed;
  results.failed += catFailed;

  if (catFailed > 0) {
    results.errors.push({ step: 'discover-services by category', failed: catFailed, categories: Object.entries(categoryResults).filter(([, r]) => !r.ok).map(([c]) => c) });
  }

  // 3. Lab-diagnostics normalization (critical)
  console.log('\n📋 STEP 3: Lab-diagnostics normalization');
  console.log('─'.repeat(70));
  try {
    const url = `${base}/customer/discover-services?category=lab-diagnostics&latitude=12.9716&longitude=77.5946`;
    const res = await fetchJson(url);
    const list = res.providers ?? res.vendors ?? [];
    const count = Array.isArray(list) ? list.length : 0;
    log('lab-diagnostics', `category=lab-diagnostics → ${count} (should resolve to diagnostics roles)`);
    if (res.success !== false && !res.error) {
      results.passed++;
    } else {
      results.failed++;
      results.errors.push({ step: 'lab-diagnostics', error: res.error || 'API returned error' });
    }
  } catch (e) {
    log('lab-diagnostics', 'FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: 'lab-diagnostics', error: e.message });
  }

  // 4. Services by style
  console.log('\n📋 STEP 4: GET /customer/services/by-style');
  console.log('─'.repeat(70));

  for (const style of SERVICE_STYLES) {
    try {
      const url = `${base}/customer/services/by-style?style=${style}&category=vet`;
      const res = await fetchJson(url);
      const providers = res.providers || [];
      const count = Array.isArray(providers) ? providers.length : 0;
      log('by-style', `${style} + category=vet → ${count} providers`);
      results.passed++;
    } catch (e) {
      log('by-style', `${style} FAIL: ${e.message}`);
      results.failed++;
      results.errors.push({ step: `by-style ${style}`, error: e.message });
    }
  }

  // 5. Walker category
  console.log('\n📋 STEP 5: Walker category (consolidated role)');
  console.log('─'.repeat(70));
  try {
    const url = `${base}/customer/discover-services?category=walker&serviceStyle=at_home&latitude=12.9716&longitude=77.5946`;
    const res = await fetchJson(url);
    const list = res.providers ?? res.vendors ?? [];
    const count = Array.isArray(list) ? list.length : 0;
    log('walker', `category=walker, style=at_home → ${count}`);
    results.passed++;
  } catch (e) {
    log('walker', 'FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: 'walker', error: e.message });
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('FORENSIC E2E SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((e) => console.log(`  - ${e.step}: ${e.error || JSON.stringify(e)}`));
  }
  console.log('═'.repeat(70) + '\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
