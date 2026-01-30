#!/usr/bin/env node
/**
 * Phase 1: Meal plan discovery – search and filters endpoints.
 * Run: npx ts-node tests/test-meal-plans-phase1.ts
 * Or:  API_ENDPOINT=https://your-api.execute-api.region.amazonaws.com npx ts-node tests/test-meal-plans-phase1.ts
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

const API_BASE =
  process.env.API_ENDPOINT ||
  process.env.TEST_API_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function request(urlString: string): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: { Accept: 'application/json' },
    };
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode!, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode!, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Phase 1: Meal plan discovery – API tests');
  console.log('Base URL:', API_BASE);
  console.log('');

  let passed = 0;
  let failed = 0;

  // 1) GET /meal-plans/search?lat=12.97&lng=77.59&maxRadius=10
  try {
    const searchUrl = `${API_BASE}/meal-plans/search?lat=12.97&lng=77.59&maxRadius=10`;
    const res = await request(searchUrl);
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    const hasShape = Array.isArray(res.body?.mealPlans);
    if (ok && hasShape) {
      console.log('✅ GET /meal-plans/search (lat, lng, maxRadius=10) [200]');
      console.log('   → mealPlans count:', res.body.mealPlans.length);
      if (res.body.mealPlans.length > 0) {
        const first = res.body.mealPlans[0];
        if (first.distanceKm != null) console.log('   → distanceKm sample:', first.distanceKm);
        if (first.estimatedDeliveryMinutes != null) console.log('   → estimatedDeliveryMinutes sample:', first.estimatedDeliveryMinutes);
      }
      passed++;
    } else {
      console.log('❌ GET /meal-plans/search', res.statusCode, res.body?.error || (hasShape ? '' : 'missing mealPlans array'));
      failed++;
    }
  } catch (e: any) {
    console.log('❌ GET /meal-plans/search', e.message);
    failed++;
  }

  // 2) GET /meal-plans/search (no lat/lng – should still 200, may return all)
  try {
    const res = await request(`${API_BASE}/meal-plans/search`);
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    const hasShape = Array.isArray(res.body?.mealPlans);
    if (ok && hasShape) {
      console.log('✅ GET /meal-plans/search (no location) [200]');
      console.log('   → mealPlans count:', res.body.mealPlans.length);
      passed++;
    } else {
      console.log('❌ GET /meal-plans/search (no location)', res.statusCode, res.body?.error || '');
      failed++;
    }
  } catch (e: any) {
    console.log('❌ GET /meal-plans/search (no location)', e.message);
    failed++;
  }

  // 3) GET /meal-plans/search/filters
  try {
    const res = await request(`${API_BASE}/meal-plans/search/filters`);
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    const f = res.body?.filters;
    const hasPurpose = Array.isArray(f?.purpose);
    const hasMealType = Array.isArray(f?.mealType);
    if (ok && f && (hasPurpose || hasMealType)) {
      console.log('✅ GET /meal-plans/search/filters [200]');
      if (hasPurpose) console.log('   → purpose options:', f.purpose.length);
      if (hasMealType) console.log('   → mealType options:', f.mealType.length);
      passed++;
    } else if (ok && f) {
      console.log('✅ GET /meal-plans/search/filters [200] (filters without purpose/mealType)');
      passed++;
    } else {
      console.log('❌ GET /meal-plans/search/filters', res.statusCode, res.body?.error || 'missing filters');
      failed++;
    }
  } catch (e: any) {
    console.log('❌ GET /meal-plans/search/filters', e.message);
    failed++;
  }

  console.log('');
  console.log('Phase 1 results:', passed, 'passed', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main();
