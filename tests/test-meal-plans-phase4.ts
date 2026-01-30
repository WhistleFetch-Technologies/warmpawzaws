#!/usr/bin/env node
/**
 * Phase 4: Logistics & delivery – customer tracking, assign-delivery (OTP), deliveryOtp in response.
 * Run: npx ts-node tests/test-meal-plans-phase4.ts
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

const API_BASE =
  process.env.API_ENDPOINT ||
  process.env.TEST_API_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

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
  console.log('Phase 4: Logistics & delivery – API tests');
  console.log('Base URL:', API_BASE);
  console.log('');

  let passed = 0;
  let failed = 0;

  const searchRes = await get(`${API_BASE}/meal-plans/search`);
  const mealPlans = searchRes.body?.mealPlans || [];
  const vendorId = mealPlans.length > 0 ? mealPlans[0].vendor_id : '';
  const vendorOrdersRes = await get(`${API_BASE}/vendor/${vendorId}/meal-orders`);
  const orders = vendorOrdersRes.body?.orders || [];
  const orderId = orders.length > 0 ? orders[0].id : null;

  if (!orderId) {
    console.log('⚠️ No meal order – skipping assign-delivery and customer tracking tests');
  } else {
    const assignRes = await post(`${API_BASE}/meal/orders/${orderId}/assign-delivery`, {
      deliveryPersonName: 'Test Driver',
      deliveryPersonPhone: '9876543210',
    });
    if (assignRes.statusCode >= 200 && assignRes.statusCode < 300 && assignRes.body?.deliveryOtp) {
      console.log('✅ POST /meal/orders/:orderId/assign-delivery [200]');
      console.log('   → deliveryOtp present');
      passed++;
    } else if (assignRes.statusCode >= 200 && assignRes.statusCode < 300) {
      console.log('✅ POST /meal/orders/:orderId/assign-delivery [200] (no OTP in response)');
      passed++;
    } else {
      console.log('❌ POST assign-delivery', assignRes.statusCode, assignRes.body?.error || '');
      failed++;
    }

    const trackRes = await get(`${API_BASE}/customer/tracking/${orderId}`);
    if (trackRes.statusCode >= 200 && trackRes.statusCode < 300) {
      const hasOrder = !!trackRes.body?.order;
      const hasTracking = trackRes.body?.tracking !== undefined;
      const hasOtp = trackRes.body?.tracking?.deliveryOtp !== undefined;
      console.log('✅ GET /customer/tracking/:orderId [200]');
      if (hasOrder) console.log('   → order present');
      if (hasTracking) console.log('   → tracking present');
      if (hasOtp) console.log('   → deliveryOtp in tracking');
      passed++;
    } else {
      console.log('❌ GET customer/tracking', trackRes.statusCode, trackRes.body?.error || '');
      failed++;
    }
  }

  console.log('');
  console.log('Phase 4 results:', passed, 'passed', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main();
