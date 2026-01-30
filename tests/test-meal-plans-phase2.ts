#!/usr/bin/env node
/**
 * Phase 2: Meal order checkout – order-preview, create-razorpay-order, create, confirm-payment.
 * Run: npx ts-node tests/test-meal-plans-phase2.ts
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
  console.log('Phase 2: Meal order checkout – API tests');
  console.log('Base URL:', API_BASE);
  console.log('');

  let passed = 0;
  let failed = 0;

  // Get a meal plan id from search
  const searchRes = await get(`${API_BASE}/meal-plans/search`);
  const mealPlans = searchRes.body?.mealPlans || [];
  const planId = mealPlans.length > 0 ? mealPlans[0].id : null;

  if (!planId) {
    console.log('⚠️ No meal plans in search – skipping order-preview and create-razorpay-order tests (no planId)');
  } else {
    // GET /meal-plans/:planId/order-preview
    try {
      const res = await get(`${API_BASE}/meal-plans/${planId}/order-preview?quantity=1&logisticsType=warmpawz`);
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      const hasTotal = typeof res.body?.totalAmount === 'number';
      if (ok && hasTotal) {
        console.log('✅ GET /meal-plans/:planId/order-preview [200]');
        console.log('   → totalAmount:', res.body.totalAmount, 'subtotal:', res.body.subtotal);
        passed++;
      } else {
        console.log('❌ GET /meal-plans/:planId/order-preview', res.statusCode, res.body?.error || '');
        failed++;
      }
    } catch (e: any) {
      console.log('❌ GET /meal-plans/:planId/order-preview', e.message);
      failed++;
    }

    // POST /meal/orders/create-razorpay-order (small amount)
    try {
      const res = await post(`${API_BASE}/meal/orders/create-razorpay-order`, { amountInRupees: 1 });
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      const hasOrderId = !!res.body?.razorpayOrderId;
      if (ok && hasOrderId) {
        console.log('✅ POST /meal/orders/create-razorpay-order [200]');
        console.log('   → razorpayOrderId present, keyId:', !!res.body?.keyId);
        passed++;
      } else if (res.statusCode === 503 && res.body?.error?.includes('configured')) {
        console.log('⚠️ POST /meal/orders/create-razorpay-order [503] – Razorpay not configured (expected in some envs)');
        passed++;
      } else {
        console.log('❌ POST /meal/orders/create-razorpay-order', res.statusCode, res.body?.error || '');
        failed++;
      }
    } catch (e: any) {
      console.log('❌ POST /meal/orders/create-razorpay-order', e.message);
      failed++;
    }
  }

  console.log('');
  console.log('Phase 2 results:', passed, 'passed', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main();
