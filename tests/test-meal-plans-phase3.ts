#!/usr/bin/env node
/**
 * Phase 3: Vendor order management – GET vendor meal-orders, accept, ETA, notify-logistics.
 * Run: npx ts-node tests/test-meal-plans-phase3.ts
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

function put(urlString: string, body: any): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'PUT',
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
  console.log('Phase 3: Vendor order management – API tests');
  console.log('Base URL:', API_BASE);
  console.log('');

  let passed = 0;
  let failed = 0;

  // Get a vendor id and order id from meal_orders (via meal/orders/vendor or search)
  const searchRes = await get(`${API_BASE}/meal-plans/search`);
  const mealPlans = searchRes.body?.mealPlans || [];
  let vendorId = '';
  let orderId = '';
  if (mealPlans.length > 0) {
    vendorId = mealPlans[0].vendor_id || '';
  }
  if (!vendorId) {
    console.log('⚠️ No meal plans / vendor – skipping vendor order tests');
  } else {
    const vendorOrdersRes = await get(`${API_BASE}/vendor/${vendorId}/meal-orders`);
    const ok = vendorOrdersRes.statusCode >= 200 && vendorOrdersRes.statusCode < 300;
    const hasOrders = Array.isArray(vendorOrdersRes.body?.orders);
    if (ok && hasOrders) {
      console.log('✅ GET /vendor/:vendorId/meal-orders [200]');
      console.log('   → orders count:', vendorOrdersRes.body.orders.length);
      if (vendorOrdersRes.body.orders.length > 0) {
        orderId = vendorOrdersRes.body.orders[0].id;
      }
      passed++;
    } else {
      console.log('❌ GET /vendor/:vendorId/meal-orders', vendorOrdersRes.statusCode, vendorOrdersRes.body?.error || '');
      failed++;
    }

    if (orderId) {
      const putRes = await put(`${API_BASE}/vendor/${vendorId}/meal-orders/${orderId}/status`, { status: 'accepted' });
      if (putRes.statusCode >= 200 && putRes.statusCode < 300) {
        console.log('✅ PUT /vendor/:vendorId/meal-orders/:orderId/status (accepted) [200]');
        passed++;
      } else {
        console.log('❌ PUT status accepted', putRes.statusCode, putRes.body?.error || '');
        failed++;
      }

      const etaRes = await post(`${API_BASE}/meal-orders/${orderId}/update-preparation-eta`, { preparationEtaMinutes: 30 });
      if (etaRes.statusCode >= 200 && etaRes.statusCode < 300) {
        console.log('✅ POST /meal-orders/:orderId/update-preparation-eta [200]');
        passed++;
      } else {
        console.log('❌ POST update-preparation-eta', etaRes.statusCode, etaRes.body?.error || '');
        failed++;
      }

      const notifyRes = await post(`${API_BASE}/meal/orders/${orderId}/notify-logistics`, {});
      if (notifyRes.statusCode >= 200 && notifyRes.statusCode < 300) {
        console.log('✅ POST /meal/orders/:orderId/notify-logistics [200]');
        passed++;
      } else {
        console.log('❌ POST notify-logistics', notifyRes.statusCode, notifyRes.body?.error || '');
        failed++;
      }
    } else {
      console.log('⚠️ No order id – skipping PUT/POST order tests');
    }
  }

  console.log('');
  console.log('Phase 3 results:', passed, 'passed', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main();
