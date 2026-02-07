#!/usr/bin/env node
/**
 * Phase 3 forensic E2E: Walker booking flow (at_home).
 * discover-services with category=walker, serviceStyle=at_home; then vendor, services, slots.
 * Plan: Walker must use discover-services with serviceStyle=at_home (not vendors/search without publish_status).
 *
 * Usage: TEST_API_URL=<base> [TEST_CUSTOMER_PHONE=91...] node scripts/forensic-walker-e2e.js
 */

const API_BASE = process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const TEST_CUSTOMER_PHONE = process.env.TEST_CUSTOMER_PHONE || '';

function tomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function log(step, message, data) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${step}] ${message}`);
  if (data != null && typeof data === 'object' && Object.keys(data).length > 0) {
    const str = JSON.stringify(data);
    if (str.length > 250) console.log('  ' + str.substring(0, 250) + '...');
    else console.log('  ' + str);
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.error || data?.message || res.statusText}`);
  return data;
}

async function main() {
  const base = API_BASE.replace(/\/$/, '');
  const results = { passed: 0, failed: 0, errors: [] };
  const date = tomorrowDateStr();

  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 3: Walker booking flow (at_home) – forensic E2E');
  console.log('═'.repeat(70));
  console.log(`API: ${base}`);
  console.log(`Date: ${date}`);
  console.log('═'.repeat(70));

  let vendorId = null;
  let resolvedVendorId = null;
  let serviceId = null;

  const urlDiscover = `${base}/customer/discover-services?category=walker&serviceStyle=at_home&latitude=12.9716&longitude=77.5946&limit=10`;
  console.log('\n📋 STEP 1: GET discover-services?category=walker&serviceStyle=at_home');
  console.log('─'.repeat(70));
  try {
    const res = await fetchJson(urlDiscover);
    const list = res.providers ?? res.vendors ?? [];
    if (!Array.isArray(list) || list.length === 0) {
      log('step1', 'discover OK (no walker at_home vendors)', { count: 0 });
      results.passed++;
    } else {
      const first = list[0];
      vendorId = first.id ?? first.vendorId ?? first.vendor_id;
      if (!vendorId) throw new Error('First vendor has no id');
      log('step1', 'discover OK', { count: list.length, vendorId: vendorId.slice(0, 8) + '...' });
      results.passed++;
    }
  } catch (e) {
    log('step1', 'FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: 'discover-services', error: e.message });
    printSummary(results);
    process.exit(1);
  }

  if (vendorId) {
    console.log('\n📋 STEP 2: GET /customer/vendor/:vendorId');
    console.log('─'.repeat(70));
    try {
      const res = await fetchJson(`${base}/customer/vendor/${vendorId}`);
      const vendor = res.vendor || res;
      if (vendor?.id) resolvedVendorId = vendor.id;
      log('step2', 'vendor OK', { id: (resolvedVendorId || vendorId).slice(0, 8) + '...' });
      results.passed++;
    } catch (e) {
      log('step2', 'FAIL', { error: e.message });
      results.failed++;
      results.errors.push({ step: 'vendor profile', error: e.message });
    }

    console.log('\n📋 STEP 3: GET /customer/vendor/:vendorId/services');
    console.log('─'.repeat(70));
    try {
      const res = await fetchJson(`${base}/customer/vendor/${vendorId}/services`);
      const services = res.services ?? [];
      if (Array.isArray(services) && services.length > 0) {
        serviceId = services[0].id ?? services[0].service_id;
      }
      log('step3', 'services OK', { count: services.length, serviceId: serviceId ? serviceId.slice(0, 8) + '...' : null });
      results.passed++;
    } catch (e) {
      log('step3', 'FAIL', { error: e.message });
      results.failed++;
      results.errors.push({ step: 'vendor services', error: e.message });
    }

    console.log('\n📋 STEP 4: GET /customer/vendor/:vendorId/available-slots');
    console.log('─'.repeat(70));
    try {
      const url = `${base}/customer/vendor/${vendorId}/available-slots?date=${date}&serviceStyle=at_home`;
      const res = await fetchJson(url);
      const hasSuccess = res.success === true;
      const slotsArray = Array.isArray(res.slots);
      if (hasSuccess && slotsArray) {
        log('step4', 'slots OK', { slotsCount: (res.slots || []).length, serviceStyle: res.serviceStyle ?? res.service_style });
        results.passed++;
      } else {
        throw new Error(`success=${hasSuccess} slotsArray=${slotsArray}`);
      }
    } catch (e) {
      log('step4', 'FAIL', { error: e.message });
      results.failed++;
      results.errors.push({ step: 'available-slots', error: e.message });
    }
  }

  printSummary(results);
  process.exit(results.failed > 0 ? 1 : 0);
}

function printSummary(results) {
  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 3 WALKER E2E SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((e) => console.log(`  - ${e.step}: ${e.error || JSON.stringify(e)}`));
  }
  console.log('═'.repeat(70) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
