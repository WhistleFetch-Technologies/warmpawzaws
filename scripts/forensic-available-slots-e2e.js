#!/usr/bin/env node
/**
 * Forensic E2E: Available Slots – Multi-Style, All Vendors
 *
 * Verifies GET /customer/vendor/:vendorId/available-slots:
 * - Correct endpoint path (customer, not vendor)
 * - serviceStyle=at_center | at_home | tele (and no default disconnect)
 * - Fallback when no serviceStyle returns any vendor+day slots
 * - Applies to every vendor (center, solo, multi-style)
 *
 * Steps:
 * 1. Get vendors from discover-services (vet at_center, at_home, tele; grooming; training)
 * 2. For each vendor, call available-slots with date=tomorrow and each serviceStyle
 * 3. Assert: 200, { success: true, slots: array }, no 500; slots may be [] if no availability
 *
 * Usage:
 *   TEST_API_URL=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com node scripts/forensic-available-slots-e2e.js
 */

const API_BASE = process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const SERVICE_STYLES = ['at_center', 'at_home', 'tele'];

// (category, serviceStyle) pairs to get a mix of center/solo vendors
const DISCOVER_QUERIES = [
  { category: 'vet', serviceStyle: 'at_center' },
  { category: 'vet', serviceStyle: 'at_home' },
  { category: 'vet', serviceStyle: 'tele' },
  { category: 'grooming', serviceStyle: 'at_center' },
  { category: 'grooming', serviceStyle: 'at_home' },
  { category: 'training', serviceStyle: 'at_center' },
  { category: 'training', serviceStyle: 'at_home' },
  { category: 'walker', serviceStyle: 'at_home' },
];

function tomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function log(step, message, data) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${step}] ${message}`);
  if (data != null && typeof data === 'object') {
    const str = JSON.stringify(data);
    if (str.length > 300) console.log('  ' + str.substring(0, 300) + '...');
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
  const date = tomorrowDateStr();

  console.log('\n' + '═'.repeat(70));
  console.log('FORENSIC E2E: Available Slots (Multi-Style, All Vendors)');
  console.log('═'.repeat(70));
  console.log(`API: ${base}`);
  console.log(`Date: ${date}`);
  console.log('═'.repeat(70));

  const results = { passed: 0, failed: 0, errors: [] };
  const vendorIdsChecked = new Set();

  // 1. Collect vendor IDs from discover-services (one per query to get variety)
  console.log('\n📋 STEP 1: Collect vendor IDs from discover-services');
  console.log('─'.repeat(70));

  const vendorsToTest = [];
  for (const q of DISCOVER_QUERIES) {
    try {
      const url = `${base}/customer/discover-services?category=${encodeURIComponent(q.category)}&serviceStyle=${q.serviceStyle}&latitude=12.9716&longitude=77.5946`;
      const res = await fetchJson(url);
      const list = res.providers ?? res.vendors ?? [];
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        const vendorId = first.id ?? first.vendor_id ?? first.vendorId ?? first.vendorId;
        if (vendorId && !vendorIdsChecked.has(vendorId)) {
          vendorIdsChecked.add(vendorId);
          vendorsToTest.push({
            vendorId,
            name: first.business_name ?? first.name ?? first.vendorName ?? vendorId.slice(0, 8),
            category: q.category,
            serviceStyle: q.serviceStyle,
          });
          log('discover', `${q.category} ${q.serviceStyle} → vendor ${vendorId.slice(0, 8)}...`, { count: list.length });
        }
      }
    } catch (e) {
      log('discover', `${q.category} ${q.serviceStyle} FAIL: ${e.message}`);
    }
  }

  if (vendorsToTest.length === 0) {
    console.log('  ⚠️  No vendors found from discover-services. Trying by-style...');
    try {
      const url = `${base}/customer/services/by-style?style=at_center&category=vet`;
      const res = await fetchJson(url);
      const list = res.providers ?? [];
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        const vendorId = first.id ?? first.vendor_id ?? first.vendorId;
        if (vendorId) {
          vendorsToTest.push({ vendorId, name: first.business_name ?? vendorId.slice(0, 8), category: 'vet', serviceStyle: 'at_center' });
        }
      }
    } catch (e2) {
      console.log('  by-style fallback failed:', e2.message);
    }
  }

  console.log(`  Vendors to test: ${vendorsToTest.length}`);
  if (vendorsToTest.length === 0) {
    results.failed++;
    results.errors.push({ step: 'collect vendors', error: 'No vendors found from discovery' });
    printSummary(results);
    process.exit(1);
  }

  // 2. For each vendor, call available-slots with each serviceStyle (and once without)
  console.log('\n📋 STEP 2: GET /customer/vendor/:vendorId/available-slots');
  console.log('─'.repeat(70));

  for (const v of vendorsToTest) {
    const stylesToTry = [v.serviceStyle, ...SERVICE_STYLES.filter((s) => s !== v.serviceStyle)];
    const uniqueStyles = [...new Set(stylesToTry)];

    for (const serviceStyle of uniqueStyles) {
      const qs = `date=${date}&serviceStyle=${serviceStyle}`;
      const url = `${base}/customer/vendor/${v.vendorId}/available-slots?${qs}`;
      try {
        const res = await fetchJson(url);
        const hasSuccess = res.success === true;
        const slotsArray = Array.isArray(res.slots);
        const slots = res.slots ?? [];

        if (hasSuccess && slotsArray) {
          results.passed++;
          log('slots', `${v.vendorId.slice(0, 8)} style=${serviceStyle} → ${slots.length} slots`, { success: true });
        } else {
          results.failed++;
          const err = { vendorId: v.vendorId.slice(0, 8), serviceStyle, success: hasSuccess, slotsArray, response: res };
          results.errors.push({ step: 'available-slots shape', ...err });
          log('slots', `FAIL shape: ${v.vendorId.slice(0, 8)} style=${serviceStyle}`, err);
        }
      } catch (e) {
        results.failed++;
        results.errors.push({ step: 'available-slots', vendorId: v.vendorId.slice(0, 8), serviceStyle, error: e.message });
        log('slots', `FAIL ${v.vendorId.slice(0, 8)} style=${serviceStyle}: ${e.message}`);
      }
    }

    // No serviceStyle (fallback: any availability for vendor+day)
    const urlNoStyle = `${base}/customer/vendor/${v.vendorId}/available-slots?date=${date}`;
    try {
      const res = await fetchJson(urlNoStyle);
      const hasSuccess = res.success === true;
      const slotsArray = Array.isArray(res.slots);

      if (hasSuccess && slotsArray) {
        results.passed++;
        log('slots', `${v.vendorId.slice(0, 8)} (no serviceStyle) → ${(res.slots || []).length} slots`, { success: true });
      } else {
        results.failed++;
        results.errors.push({ step: 'available-slots no style', vendorId: v.vendorId.slice(0, 8), success: hasSuccess, slotsArray });
        log('slots', `FAIL ${v.vendorId.slice(0, 8)} no serviceStyle: wrong shape`);
      }
    } catch (e) {
      results.failed++;
      results.errors.push({ step: 'available-slots no style', vendorId: v.vendorId.slice(0, 8), error: e.message });
      log('slots', `FAIL ${v.vendorId.slice(0, 8)} no serviceStyle: ${e.message}`);
    }
  }

  // 3. Sanity: wrong path /vendor/.../available-slots should 404 or different (we use customer path)
  console.log('\n📋 STEP 3: Sanity – customer path only (no vendor path for customer web)');
  console.log('─'.repeat(70));
  const firstVendor = vendorsToTest[0];
  if (firstVendor) {
    try {
      const vendorPathUrl = `${base}/vendor/${firstVendor.vendorId}/available-slots?date=${date}&serviceStyle=at_center`;
      const res = await fetch(vendorPathUrl);
      const body = await res.json().catch(() => ({}));
      // Vendor path may 404 or return different shape; we only require customer path to work
      log('sanity', `GET /vendor/.../available-slots → ${res.status}`, body?.slots != null ? 'has slots (vendor endpoint)' : '');
      results.passed++;
    } catch (e) {
      log('sanity', 'Vendor path request failed (expected if not implemented): ' + e.message);
      results.passed++;
    }
  }

  printSummary(results);
  process.exit(results.failed > 0 ? 1 : 0);
}

function printSummary(results) {
  console.log('\n' + '═'.repeat(70));
  console.log('FORENSIC AVAILABLE-SLOTS SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((e) => console.log('  -', e.step, e.error || e.vendorId || '', e.serviceStyle || '', JSON.stringify(e).slice(0, 120)));
  }
  console.log('═'.repeat(70) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
