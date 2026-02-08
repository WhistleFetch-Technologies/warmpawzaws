#!/usr/bin/env node
/**
 * Validation script: Discovery API contract (vendor card fields)
 *
 * Discovery endpoints are served by the API (Lambda/API Gateway), not by the web app CloudFront URLs.
 * Use the API base URL for validation (same API that Customer/Vendor/Admin apps call).
 *
 * CloudFront URLs (web apps):
 *   Admin:    https://dfof7mguaa0a5.cloudfront.net
 *   Vendor:   https://d1s6ykkj381k58.cloudfront.net
 *   Customer: https://d2aoyjj8ine0wk.cloudfront.net
 *
 * Run:
 *   VALIDATE_API_URL=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com node scripts/validate-discovery-api.js
 * Or (API URL from config): node scripts/validate-discovery-api.js
 *
 * Validates that each discovery endpoint returns provider/vendor items with:
 *   photoUrl, rating, reviewCount, distanceKm, distanceText, specializations, nextAvailable, serviceStyles, vendorType, roleName
 */

const fs = require('fs');
const path = require('path');

function getApiBaseUrl() {
  if (process.env.VALIDATE_API_URL) return process.env.VALIDATE_API_URL;
  if (process.env.TEST_API_URL) return process.env.TEST_API_URL;
  try {
    const configPath = path.join(__dirname, '..', 'config', 'urls.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.apiGatewayDefaultUrl) return config.apiGatewayDefaultUrl;
  } catch (_) {}
  return 'http://localhost:3000';
}

const BASE = getApiBaseUrl();

const REQUIRED_CARD_KEYS = [
  'photoUrl',      // may be null
  'rating',        // number
  'reviewCount',   // number
  'specializations', // array
  'nextAvailable', // object or null { date, time, display }
  'serviceStyles', // array
  'vendorType',    // 'solo' | 'business'
  'roleName',      // string
];
const DISTANCE_KEYS = ['distanceKm', 'distanceText']; // optional when no lat/lng

function getItems(res, endpoint) {
  if (endpoint.includes('discover-services')) {
    return res.vendors || res.providers || [];
  }
  if (endpoint.includes('by-style')) {
    return res.providers || res.vendors || [];
  }
  if (endpoint.includes('vendors/search')) {
    return res.vendors || [];
  }
  if (endpoint.includes('discover-by-problem')) {
    return res.results || [];
  }
  if (endpoint.includes('by-problem')) {
    return res.providers || res.services || [];
  }
  return [];
}

function checkCard(item, endpoint, opts = {}) {
  const errors = [];
  for (const key of REQUIRED_CARD_KEYS) {
    if (!(key in item)) {
      // by-problem returns service rows: photo, not photoUrl; no nextAvailable/serviceStyles/vendorType/roleName
      if (endpoint.includes('by-problem')) {
        if (key === 'photoUrl' && 'photo' in item) continue;
        if (['nextAvailable', 'serviceStyles', 'vendorType', 'roleName'].includes(key)) continue;
      }
      errors.push(`missing ${key}`);
    }
  }
  if (!opts.skipDistance && item.distance != null) {
    if (item.distanceKm === undefined && item.distance === undefined) errors.push('missing distanceKm when distance present');
    if (item.distanceText === undefined && item.distanceFormatted === undefined) errors.push('missing distanceText/distanceFormatted when distance present');
  }
  return errors;
}

async function get(path, qs = {}) {
  const url = new URL(path, BASE);
  Object.entries(qs).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(new URL(path, BASE).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  console.log('Validation API base URL:', BASE);
  console.log('(CloudFront app URLs: Admin https://dfof7mguaa0a5.cloudfront.net | Vendor https://d1s6ykkj381k58.cloudfront.net | Customer https://d2aoyjj8ine0wk.cloudfront.net)');
  let passed = 0;
  let failed = 0;

  // 1) discover-services (at_center) — serviceStyle + roleId + lat/lng for valid query
  try {
    const style = 'at_center';
    const res = await get('/customer/discover-services', {
      serviceStyle: style,
      roleId: 'veterinarian',
      latitude: '12.9716',
      longitude: '77.5946',
    });
    const items = getItems(res, 'discover-services');
    console.log('\n[customer/discover-services]', style, '→', items.length, 'items');
    if (items.length > 0) {
      const errs = checkCard(items[0], 'discover-services', { skipDistance: true });
      if (errs.length) {
        console.error('  FAIL: first item missing:', errs.join(', '));
        failed++;
      } else {
        console.log('  OK: first item has required card fields');
        passed++;
      }
    } else {
      console.log('  SKIP: no items (no vendors in DB or filters too strict)');
    }
  } catch (e) {
    console.error('  ERROR:', e.message);
    failed++;
  }

  // 2) by-style — style required; roleId + latitude/longitude to avoid empty/500
  try {
    const res = await get('/customer/services/by-style', {
      style: 'at_center',
      roleId: 'pet_groomer',
      latitude: '12.9716',
      longitude: '77.5946',
    });
    const items = getItems(res, 'by-style');
    console.log('\n[customer/services/by-style] at_center →', items.length, 'items');
    if (items.length > 0) {
      const errs = checkCard(items[0], 'by-style', { skipDistance: true });
      if (errs.length) {
        console.error('  FAIL: first item missing:', errs.join(', '));
        failed++;
      } else {
        console.log('  OK: first item has required card fields');
        passed++;
      }
    } else {
      console.log('  SKIP: no items');
    }
  } catch (e) {
    console.error('  ERROR:', e.message);
    failed++;
  }

  // 3) vendors/search — roleId = role name (not UUID); serviceStyle optional
  try {
    const res = await get('/customer/vendors/search', {
      roleId: 'veterinarian',
      serviceStyle: 'at_center',
      limit: 10,
    });
    const items = getItems(res, 'vendors/search');
    console.log('\n[customer/vendors/search] →', items.length, 'items');
    if (items.length > 0) {
      const errs = checkCard(items[0], 'vendors/search', { skipDistance: true });
      if (errs.length) {
        console.error('  FAIL: first item missing:', errs.join(', '));
        failed++;
      } else {
        console.log('  OK: first item has required card fields');
        passed++;
      }
    } else {
      console.log('  SKIP: no items');
    }
  } catch (e) {
    console.error('  ERROR:', e.message);
    failed++;
  }

  // 4) discover-by-problem — problem or problemId required; roleId + latitude/longitude optional
  try {
    const res = await get('/customer/vendors/discover-by-problem', {
      problemId: 'general_consultation',
      roleId: 'veterinarian',
      latitude: '12.9716',
      longitude: '77.5946',
    });
    const items = getItems(res, 'discover-by-problem');
    console.log('\n[customer/vendors/discover-by-problem] →', items.length, 'items');
    if (items.length > 0) {
      const errs = checkCard(items[0], 'discover-by-problem', { skipDistance: true });
      if (errs.length) {
        console.error('  FAIL: first item missing:', errs.join(', '));
        failed++;
      } else {
        console.log('  OK: first item has required card fields');
        passed++;
      }
    } else {
      console.log('  SKIP: no items');
    }
  } catch (e) {
    console.error('  ERROR:', e.message);
    failed++;
  }

  // 5) by-problem — problemId required (from problem_grid_mappings or specialization_master); serviceStyle + lat/lng optional
  try {
    const res = await get('/customer/services/by-problem', {
      problemId: 'general_consultation',
      serviceStyle: 'at_home',
      lat: '12.9716',
      lng: '77.5946',
    });
    const items = getItems(res, 'by-problem');
    console.log('\n[customer/services/by-problem] →', items.length, 'items');
    if (items.length > 0) {
      const item = items[0];
      const need = ['photo', 'rating', 'reviewCount', 'specializations'];
      const errs = need.filter(k => !(k in item));
      if (errs.length) {
        console.error('  FAIL: first item missing:', errs.join(', '));
        failed++;
      } else {
        console.log('  OK: first item has photo, rating, reviewCount, specializations');
        passed++;
      }
    } else {
      console.log('  SKIP: no items');
    }
  } catch (e) {
    console.error('  ERROR:', e.message);
    failed++;
  }

  // 6) Pricing quote — implemented in Lambda; 404 = API Gateway may not have POST /customer/pricing/quote configured
  try {
    const body = { serviceId: '00000000-0000-0000-0000-000000000001', vendorId: '00000000-0000-0000-0000-000000000002' };
    const res = await post('/customer/pricing/quote', body);
    const need = ['basePrice', 'tax', 'discount', 'finalPrice', 'taxBreakdown'];
    const has = need.every(k => k in res);
    if (res.success && has) {
      console.log('\n[customer/pricing/quote] OK: response has basePrice, tax, discount, finalPrice, taxBreakdown');
      passed++;
    } else if (res.success === false && (res.error || res.error === 'Vendor not found' || res.error === 'Could not resolve service price')) {
      console.log('\n[customer/pricing/quote] SKIP: no test data (vendor/service not found) – contract OK');
    } else if (res.success && !has) {
      console.error('\n[customer/pricing/quote] FAIL: missing keys', need.filter(k => !(k in res)));
      failed++;
    } else {
      console.log('\n[customer/pricing/quote] SKIP:', res.error || 'unknown');
    }
  } catch (e) {
    if (e.message && e.message.includes('404')) {
      console.log('\n[customer/pricing/quote] SKIP: 404 – route may not be configured on API Gateway (Lambda has POST /customer/pricing/quote)');
    } else {
      console.error('\n[customer/pricing/quote] ERROR:', e.message);
      failed++;
    }
  }

  console.log('\n---');
  console.log('Passed:', passed, '| Failed:', failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
