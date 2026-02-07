#!/usr/bin/env node
/**
 * Phase 2 forensic E2E: Grooming booking flow (at_center and at_home).
 * 1. GET discover-services grooming at_center; pick first vendor; vendor + services + slots
 * 2. GET discover-services grooming at_home; pick first vendor; vendor + services + slots
 * 3. If TEST_CUSTOMER_PHONE set: optional POST bookings/create for one style; assert style stored
 * Uses same query/body param names as UI (booking-contract.ts).
 *
 * Usage: TEST_API_URL=<base> [TEST_CUSTOMER_PHONE=91...] node scripts/forensic-grooming-e2e.js
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
  const prefix = `grooming ${style}`;
  let vendorId = null;
  let serviceId = null;

  const urlDiscover = `${base}/customer/discover-services?category=grooming&serviceStyle=${style}&latitude=12.9716&longitude=77.5946&limit=10`;
  try {
    const res = await fetchJson(urlDiscover);
    const list = res.providers ?? res.vendors ?? [];
    if (!Array.isArray(list) || list.length === 0) {
      log(prefix, 'discover OK (no vendors for this style)', { count: 0 });
      results.passed++;
      return { vendorId: null, serviceId: null, resolvedVendorId: null };
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
    return { vendorId: null, serviceId: null, resolvedVendorId: null };
  }

  if (!vendorId) return { vendorId: null, serviceId: null, resolvedVendorId: null };

  let resolvedVendorId = vendorId;
  try {
    const res = await fetchJson(`${base}/customer/vendor/${vendorId}`);
    const vendor = res.vendor || res;
    if (vendor?.id) resolvedVendorId = vendor.id;
    log(prefix, 'vendor OK', { id: resolvedVendorId.slice(0, 8) + '...' });
    results.passed++;
  } catch (e) {
    log(prefix, 'vendor FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: `vendor ${style}`, error: e.message });
  }

  try {
    const res = await fetchJson(`${base}/customer/vendor/${vendorId}/services`);
    const services = res.services ?? [];
    if (Array.isArray(services) && services.length > 0) {
      serviceId = services[0].id ?? services[0].service_id;
    }
    log(prefix, 'services OK', { count: services.length, serviceId: serviceId ? serviceId.slice(0, 8) + '...' : null });
    results.passed++;
  } catch (e) {
    log(prefix, 'services FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: `services ${style}`, error: e.message });
  }

  try {
    const urlSlots = `${base}/customer/vendor/${vendorId}/available-slots?date=${date}&serviceStyle=${style}`;
    const res = await fetchJson(urlSlots);
    const hasSuccess = res.success === true;
    const slotsArray = Array.isArray(res.slots);
    const responseStyle = res.serviceStyle ?? res.service_style;
    if (hasSuccess && slotsArray) {
      log(prefix, 'slots OK', { slotsCount: (res.slots || []).length, serviceStyle: responseStyle });
      if (responseStyle && responseStyle !== style) {
        results.failed++;
        results.errors.push({ step: `slots style ${style}`, error: `response serviceStyle=${responseStyle} expected ${style}` });
      } else {
        results.passed++;
      }
    } else {
      throw new Error(`success=${hasSuccess} slotsArray=${slotsArray}`);
    }
  } catch (e) {
    log(prefix, 'slots FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: `slots ${style}`, error: e.message });
  }

  return { vendorId, serviceId, resolvedVendorId };
}

async function main() {
  const base = API_BASE.replace(/\/$/, '');
  const results = { passed: 0, failed: 0, errors: [] };
  const date = tomorrowDateStr();

  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 2: Grooming booking flow (at_center + at_home) – forensic E2E');
  console.log('═'.repeat(70));
  console.log(`API: ${base}`);
  console.log(`Date: ${date}`);
  console.log('═'.repeat(70));

  const atCenter = await runFlowForStyle(base, 'at_center', date, results);
  const atHome = await runFlowForStyle(base, 'at_home', date, results);

  if (TEST_CUSTOMER_PHONE && (atCenter.vendorId && atCenter.serviceId) || (atHome.vendorId && atHome.serviceId)) {
    const { vendorId, serviceId, resolvedVendorId } = atCenter.vendorId ? atCenter : atHome;
    const serviceType = atCenter.vendorId ? 'at_center' : 'at_home';
    console.log('\n📋 STEP: POST /bookings/create (style ' + serviceType + ')');
    console.log('─'.repeat(70));
    let customerId = null;
    try {
      const byPhoneRes = await fetchJson(`${base}/customer/by-phone?phone=${encodeURIComponent(TEST_CUSTOMER_PHONE)}`);
      const customer = byPhoneRes.customer ?? byPhoneRes;
      customerId = customer?.id ?? customer?.customerId;
    } catch (e) {
      log('create', 'by-phone FAIL (skip create)', { error: e.message });
    }
    if (customerId && vendorId && serviceId) {
      try {
        const body = {
          customerId,
          vendorId,
          serviceId,
          bookingDate: date,
          bookingTime: '10:00',
          serviceType,
        };
        const createRes = await fetchJson(`${base}/bookings/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const bookingId = createRes.booking?.id ?? createRes.bookingId ?? createRes.id;
        const resStyle = createRes.booking?.service_type ?? createRes.booking?.service_style ?? createRes.serviceType;
        if (bookingId) {
          log('create', 'OK', { bookingId: bookingId.slice(0, 8) + '...', serviceType: resStyle });
          if (resStyle && resStyle !== serviceType) {
            results.failed++;
            results.errors.push({ step: 'create style', error: `response serviceType=${resStyle} expected ${serviceType}` });
          } else {
            results.passed++;
          }
        } else {
          throw new Error('Missing booking id in response');
        }
      } catch (e) {
        log('create', 'FAIL', { error: e.message });
        results.failed++;
        results.errors.push({ step: 'bookings/create', error: e.message });
      }
    }
  } else {
    console.log('\n📋 STEP: Create skipped (set TEST_CUSTOMER_PHONE to run create)');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 2 GROOMING E2E SUMMARY');
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
