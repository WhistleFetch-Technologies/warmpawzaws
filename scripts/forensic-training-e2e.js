#!/usr/bin/env node
/**
 * Phase 3 forensic E2E: Training booking flow (at_center and at_home).
 * discover-services category=training with serviceStyle=at_center and at_home; vendor, services, slots per style.
 *
 * Usage: TEST_API_URL=<base> [TEST_CUSTOMER_PHONE=91...] node scripts/forensic-training-e2e.js
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

async function runFlowForStyle(base, style, date, results) {
  const prefix = `training ${style}`;
  let vendorId = null;

  const urlDiscover = `${base}/customer/discover-services?category=training&serviceStyle=${style}&latitude=12.9716&longitude=77.5946&limit=10`;
  try {
    const res = await fetchJson(urlDiscover);
    const list = res.providers ?? res.vendors ?? [];
    if (!Array.isArray(list) || list.length === 0) {
      log(prefix, 'discover OK (no vendors for this style)', { count: 0 });
      results.passed++;
      return;
    }
    const first = list[0];
    vendorId = first.id ?? first.vendorId ?? first.vendor_id;
    if (!vendorId) throw new Error('First vendor has no id');
    log(prefix, 'discover OK', { count: list.length, vendorId: vendorId.slice(0, 8) + '...' });
    results.passed++;
  } catch (e) {
    log(prefix, 'discover FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: `discover ${style}`, error: e.message });
    return;
  }

  if (!vendorId) return;

  try {
    const res = await fetchJson(`${base}/customer/vendor/${vendorId}`);
    const vendor = res.vendor || res;
    if (res.error || !vendor?.id) throw new Error(res.error || 'Missing vendor id');
    log(prefix, 'vendor OK', { id: vendor.id.slice(0, 8) + '...' });
    results.passed++;
  } catch (e) {
    log(prefix, 'vendor FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: `vendor ${style}`, error: e.message });
    return;
  }

  try {
    const res = await fetchJson(`${base}/customer/vendor/${vendorId}/services`);
    const services = res.services ?? [];
    log(prefix, 'services OK', { count: services.length });
    results.passed++;
  } catch (e) {
    log(prefix, 'services FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: `services ${style}`, error: e.message });
    return;
  }

  try {
    const urlSlots = `${base}/customer/vendor/${vendorId}/available-slots?date=${date}&serviceStyle=${style}`;
    const res = await fetchJson(urlSlots);
    const hasSuccess = res.success === true;
    const slotsArray = Array.isArray(res.slots);
    if (hasSuccess && slotsArray) {
      log(prefix, 'slots OK', { slotsCount: (res.slots || []).length, serviceStyle: res.serviceStyle ?? res.service_style });
      results.passed++;
    } else {
      throw new Error(`success=${hasSuccess} slotsArray=${slotsArray}`);
    }
  } catch (e) {
    log(prefix, 'slots FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: `slots ${style}`, error: e.message });
  }
}

async function main() {
  const base = API_BASE.replace(/\/$/, '');
  const results = { passed: 0, failed: 0, errors: [] };
  const date = tomorrowDateStr();

  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 3: Training booking flow (at_center + at_home) – forensic E2E');
  console.log('═'.repeat(70));
  console.log(`API: ${base}`);
  console.log(`Date: ${date}`);
  console.log('═'.repeat(70));

  await runFlowForStyle(base, 'at_center', date, results);
  await runFlowForStyle(base, 'at_home', date, results);

  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 3 TRAINING E2E SUMMARY');
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
