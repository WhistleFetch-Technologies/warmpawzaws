#!/usr/bin/env node
/**
 * Phase 6 forensic E2E: Payment page dynamic policies (tax, fees, refund, payment policies).
 * Asserts: GET /config/fees returns success and fee fields; POST /tax/calculate returns tax; GET /config/policies returns payment/cancellation/refund; GET /customer/refund-policy returns policy.
 *
 * Usage: TEST_API_URL=<base> node scripts/forensic-payment-dynamic-e2e.js
 */

const API_BASE = process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function log(step, message, data) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${step}] ${message}`);
  if (data != null && typeof data === 'object' && Object.keys(data).length > 0) {
    const str = JSON.stringify(data);
    if (str.length > 180) console.log('  ' + str.substring(0, 180) + '...');
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

  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 6: Payment dynamic policies (fees, tax, refund, payment) – forensic E2E');
  console.log('═'.repeat(70));
  console.log(`API: ${base}`);
  console.log('═'.repeat(70));

  const amount = 500;

  console.log('\n📋 STEP 1: GET /config/fees');
  console.log('─'.repeat(70));
  try {
    const res = await fetchJson(`${base}/config/fees?serviceStyle=at_center&amount=${amount}&type=booking`);
    if (res.success !== false && (res.fees != null || res.platformFee != null)) {
      results.passed++;
      log('step1', 'OK', { success: res.success, hasFees: true });
    } else {
      throw new Error('Missing success or fees in response');
    }
  } catch (e) {
    log('step1', 'FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: 'config/fees', error: e.message });
  }

  console.log('\n📋 STEP 2: POST /tax/calculate');
  console.log('─'.repeat(70));
  try {
    const res = await fetchJson(`${base}/tax/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: 'item', type: 'service', amount: amount, quantity: 1, category: 'pet_services' }],
      }),
    });
    const hasTax = res.totalTax != null || (res.totalCGST != null && res.totalSGST != null);
    if (res.success !== false && hasTax) {
      results.passed++;
      log('step2', 'OK', { totalTax: res.totalTax, success: res.success });
    } else {
      throw new Error('Missing tax fields in response');
    }
  } catch (e) {
    log('step2', 'FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: 'tax/calculate', error: e.message });
  }

  console.log('\n📋 STEP 3: GET /config/policies (payment, cancellation, refund)');
  console.log('─'.repeat(70));
  try {
    const res = await fetchJson(`${base}/config/policies?service_type=booking&policies=payment,cancellation,refund`);
    const policies = res.policies || res;
    const hasPayment = policies.payment && (policies.payment.title || policies.payment.description);
    if (res.success !== false && (hasPayment || policies.cancellation || policies.refund)) {
      results.passed++;
      log('step3', 'OK', { keys: Object.keys(policies) });
    } else {
      throw new Error('Missing policies in response');
    }
  } catch (e) {
    log('step3', 'FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: 'config/policies', error: e.message });
  }

  console.log('\n📋 STEP 4: GET /customer/refund-policy');
  console.log('─'.repeat(70));
  try {
    const res = await fetchJson(`${base}/customer/refund-policy`);
    const hasPolicy = res.policy && (res.policy.refundPercentages || res.policy.cancellationWindowHours != null);
    if (res.success !== false && hasPolicy) {
      results.passed++;
      log('step4', 'OK', { hasPolicy: true });
    } else {
      throw new Error('Missing policy in response');
    }
  } catch (e) {
    log('step4', 'FAIL', { error: e.message });
    results.failed++;
    results.errors.push({ step: 'customer/refund-policy', error: e.message });
  }

  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 6 PAYMENT DYNAMIC E2E SUMMARY');
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
