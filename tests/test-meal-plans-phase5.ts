#!/usr/bin/env node
/**
 * Phase 5: Customer tracking widget & review – meals/active, order-tracking (meal), POST review.
 * Run: npx ts-node tests/test-meal-plans-phase5.ts
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

const API_BASE =
  process.env.API_ENDPOINT ||
  process.env.TEST_API_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const TEST_PHONE = process.env.TEST_CUSTOMER_PHONE || '9876543210';

function get(urlString: string): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      { hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + url.search, method: 'GET', headers: { Accept: 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode!, body: JSON.parse(data) });
          } catch {
            resolve({ statusCode: res.statusCode!, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function post(urlString: string, body: any): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode!, body: JSON.parse(data) });
          } catch {
            resolve({ statusCode: res.statusCode!, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('Phase 5: Customer tracking widget & review – API tests');
  console.log('Base URL:', API_BASE);
  console.log('');

  let passed = 0;
  let failed = 0;

  // GET /customer/:phone/orders/meals/active – must return 200 and orders array (no tracking_status column dependency)
  const phoneEnc = encodeURIComponent(TEST_PHONE);
  const activeRes = await get(`${API_BASE}/customer/${phoneEnc}/orders/meals/active`);
  if (activeRes.statusCode >= 200 && activeRes.statusCode < 300) {
    const orders = activeRes.body?.orders;
    if (Array.isArray(orders)) {
      console.log('✅ GET /customer/:phone/orders/meals/active [200]');
      console.log('   → orders array, length:', orders.length);
      if (orders.length > 0 && orders[0].orderType === 'meal') {
        console.log('   → orderType: meal present');
      }
      passed++;
    } else {
      console.log('❌ GET meals/active – response.orders not an array', typeof orders);
      failed++;
    }
  } else {
    console.log('❌ GET meals/active', activeRes.statusCode, activeRes.body?.error || '');
    failed++;
  }

  // POST /meal/orders/:orderId/review – need a delivered meal order
  const searchRes = await get(`${API_BASE}/meal-plans/search`);
  const mealPlans = searchRes.body?.mealPlans || [];
  const vendorId = mealPlans.length > 0 ? mealPlans[0].vendor_id : '';
  const vendorOrdersRes = await get(`${API_BASE}/vendor/${vendorId}/meal-orders`);
  const orders = vendorOrdersRes.body?.orders || [];
  const deliveredOrder = orders.find((o: any) => o.status === 'delivered');
  const orderId = deliveredOrder?.id || null;

  if (!orderId) {
    console.log('⚠️ No delivered meal order – skipping review endpoint test');
    // Validate review endpoint returns 400 for non-delivered or 404 for invalid id
    const badReviewRes = await post(`${API_BASE}/meal/orders/00000000-0000-0000-0000-000000000000/review`, { rating: 5 });
    if (badReviewRes.statusCode === 404) {
      console.log('✅ POST /meal/orders/:orderId/review [404] for invalid orderId');
      passed++;
    }
  } else {
    const reviewRes = await post(`${API_BASE}/meal/orders/${orderId}/review`, {
      rating: 5,
      review: 'Phase 5 test review',
    });
    if (reviewRes.statusCode >= 200 && reviewRes.statusCode < 300) {
      console.log('✅ POST /meal/orders/:orderId/review [200]');
      passed++;
    } else if (reviewRes.statusCode === 400 && reviewRes.body?.error?.includes('already reviewed')) {
      console.log('✅ POST /meal/orders/:orderId/review [400] already reviewed (expected if re-run)');
      passed++;
    } else {
      console.log('❌ POST review', reviewRes.statusCode, reviewRes.body?.error || '');
      failed++;
    }
  }

  console.log('');
  console.log('Phase 5 results:', passed, 'passed', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main();
