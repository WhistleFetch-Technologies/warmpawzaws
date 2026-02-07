#!/usr/bin/env node
/**
 * Test vendor discovery and packages endpoints (serviceStyle filters).
 * Run: npx ts-node tests/test-vendor-discovery-endpoints.ts
 * Or:  API_ENDPOINT=http://localhost:3000 npx ts-node tests/test-vendor-discovery-endpoints.ts
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
  console.log('Base URL:', API_BASE);
  console.log('');

  const tests: { name: string; path: string; check?: (r: any) => string | null }[] = [
    { name: 'Discover services (at_center vet)', path: '/customer/discover-services?category=vet&serviceStyle=at_center' },
    { name: 'Discover services (at_home grooming)', path: '/customer/discover-services?category=grooming&serviceStyle=at_home' },
    { name: 'Discover services (at_home training)', path: '/customer/discover-services?category=training&serviceStyle=at_home' },
    { name: 'Discover services (at_home walker)', path: '/customer/discover-services?category=walker&serviceStyle=at_home' },
    { name: 'Discover services (tele vet)', path: '/customer/discover-services?category=vet&serviceStyle=tele' },
    { name: 'Discover services (no style - all)', path: '/customer/discover-services?category=vet' },
    { name: 'Vendors search (pet_walker at_home)', path: '/customer/vendors/search?roleId=pet_walker&serviceStyle=at_home' },
    { name: 'Vendors search (pet_walker no style)', path: '/customer/vendors/search?roleId=pet_walker' },
    { name: 'Packages discover (at_center)', path: '/packages/discover?serviceStyle=at_center' },
    { name: 'Packages discover (at_home)', path: '/packages/discover?serviceStyle=at_home' },
    { name: 'Packages discover (tele)', path: '/packages/discover?serviceStyle=tele' },
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      const res = await request(`${API_BASE}${t.path}`);
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      const note = t.check ? t.check(res.body) : null;
      if (ok && !note) {
        console.log('✅', t.name, `[${res.statusCode}]`);
        const total = (res.body?.vendors?.length ?? res.body?.providers?.length ?? res.body?.total ?? res.body?.packages?.length ?? '-');
        if (typeof total === 'number') console.log('   → count:', total);
        passed++;
      } else if (note) {
        console.log('⚠️', t.name, `[${res.statusCode}]`, note);
        passed++;
      } else {
        console.log('❌', t.name, `[${res.statusCode}]`, res.body?.error || res.body?.message || '');
        failed++;
      }
    } catch (e: any) {
      console.log('❌', t.name, 'Error:', e.message || e);
      failed++;
    }
  }

  console.log('');
  console.log('---');
  console.log('Passed:', passed, '| Failed:', failed);
}

main().catch(console.error);
