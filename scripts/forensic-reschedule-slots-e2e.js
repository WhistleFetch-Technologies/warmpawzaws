#!/usr/bin/env node
/**
 * Phase 5 forensic E2E: Reschedule slots aligned with customer slots.
 * With BOOKING_ID and DATE: GET /vendor/available-slots for reschedule, GET /customer/vendor/:id/available-slots for same vendor/date/style; assert both return success and slots array.
 * Without BOOKING_ID: GET /vendor/available-slots without bookingId asserts 400.
 *
 * Usage: TEST_API_URL=<base> [BOOKING_ID=<uuid>] [DATE=YYYY-MM-DD] node scripts/forensic-reschedule-slots-e2e.js
 */

const API_BASE = process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const BOOKING_ID = process.env.BOOKING_ID || '';
const DATE = process.env.DATE || (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();

function log(step, message, data) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${step}] ${message}`);
  if (data != null && typeof data === 'object' && Object.keys(data).length > 0) {
    const str = JSON.stringify(data);
    if (str.length > 200) console.log('  ' + str.substring(0, 200) + '...');
    else console.log('  ' + str);
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.error || data?.message || res.statusText}`);
  return data;
}

async function main() {
  const base = API_BASE.replace(/\/$/, '');
  const results = { passed: 0, failed: 0, errors: [] };

  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 5: Reschedule slots alignment – forensic E2E');
  console.log('═'.repeat(70));
  console.log(`API: ${base}`);
  console.log('═'.repeat(70));

  // Test: missing bookingId returns 400
  console.log('\n📋 STEP 1: GET /vendor/available-slots (no bookingId) → expect 400');
  console.log('─'.repeat(70));
  try {
    await fetchJson(`${base}/vendor/available-slots?date=${DATE}`);
    results.failed++;
    results.errors.push({ step: 'vendor/available-slots no bookingId', error: 'Expected 400' });
    log('step1', 'FAIL', { error: 'Expected 400' });
  } catch (e) {
    if (e.message && e.message.includes('400')) {
      results.passed++;
      log('step1', 'OK', { got: '400' });
    } else {
      results.failed++;
      results.errors.push({ step: 'vendor/available-slots no bookingId', error: e.message });
      log('step1', 'FAIL', { error: e.message });
    }
  }

  if (BOOKING_ID) {
    console.log('\n📋 STEP 2: GET /vendor/available-slots?bookingId=&date= (reschedule)');
    console.log('─'.repeat(70));
    try {
      const url = `${base}/vendor/available-slots?bookingId=${encodeURIComponent(BOOKING_ID)}&date=${DATE}&serviceStyle=at_center`;
      const res = await fetchJson(url);
      const slotsArray = Array.isArray(res.slots);
      if (res.success && slotsArray) {
        results.passed++;
        log('step2', 'OK', { slotsCount: (res.slots || []).length });
      } else {
        throw new Error(`success=${res.success} slotsArray=${slotsArray}`);
      }
    } catch (e) {
      log('step2', 'FAIL', { error: e.message });
      results.failed++;
      results.errors.push({ step: 'vendor/available-slots', error: e.message });
    }

    console.log('\n📋 STEP 3: GET /customer/vendor/:vendorId/available-slots (same vendor/date/style)');
    console.log('─'.repeat(70));
    let vendorId = null;
    try {
      const bookingRes = await fetchJson(`${base}/bookings/${BOOKING_ID}`).catch(() => ({}));
      vendorId = bookingRes.booking?.vendor_id ?? bookingRes.vendor_id ?? bookingRes.vendorId;
    } catch (_) {}
    if (vendorId) {
      try {
        const url = `${base}/customer/vendor/${vendorId}/available-slots?date=${DATE}&serviceStyle=at_center`;
        const res = await fetchJson(url);
        const slotsArray = Array.isArray(res.slots);
        if (res.success && slotsArray) {
          results.passed++;
          log('step3', 'OK', { slotsCount: (res.slots || []).length });
        } else {
          throw new Error(`success=${res.success} slotsArray=${slotsArray}`);
        }
      } catch (e) {
        log('step3', 'FAIL', { error: e.message });
        results.failed++;
        results.errors.push({ step: 'customer available-slots', error: e.message });
      }
    } else {
      log('step3', 'Skipped (could not get vendorId from booking)');
    }
  } else {
    console.log('\n📋 STEP 2–3: Skipped (set BOOKING_ID to run reschedule vs customer slots comparison)');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 5 RESCHEDULE SLOTS E2E SUMMARY');
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
