#!/usr/bin/env node
/**
 * Discovery regression — functional parity checks for slim VendorCardDTO branch.
 * Validates envelopes, cursor pagination, vendor-services lazy load, category-bootstrap.
 *
 * Usage:
 *   node scripts/discovery-regression-parity.js
 *   API_BASE=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com node scripts/discovery-regression-parity.js
 */

const API_BASE =
  process.env.API_BASE || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const LAT = process.env.LAT || '12.9716';
const LNG = process.env.LNG || '77.5946';
const PHONE = process.env.CUSTOMER_PHONE || '';

const loc = `latitude=${LAT}&longitude=${LNG}`;
const phoneQ = PHONE ? `&customerPhone=${encodeURIComponent(PHONE)}` : '';

const VENDOR_CARD_KEYS = [
  'id',
  'vendorId',
  'name',
  'rating',
  'reviewCount',
  'isVerified',
  'isOnline',
];

let failed = 0;
let passed = 0;

function pass(name, detail = '') {
  passed++;
  console.log(`PASS | ${name}${detail ? ' | ' + detail : ''}`);
}

function fail(name, detail = '') {
  failed++;
  console.error(`FAIL | ${name}${detail ? ' | ' + detail : ''}`);
}

function assertVendorCard(v, ctx) {
  const missing = VENDOR_CARD_KEYS.filter((k) => !(k in v));
  if (missing.length) fail(`${ctx} vendor card`, `missing keys: ${missing.join(', ')}`);
  else pass(`${ctx} vendor card shape`);
  if ('providers' in v) fail(`${ctx}`, 'nested providers on card (unexpected)');
  if (Array.isArray(v.services) && v.services.length > 0) {
    fail(`${ctx}`, `embedded services[] on list card (${v.services.length}) — should lazy-load`);
  }
}

async function getJson(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function main() {
  console.log('Discovery regression parity');
  console.log(`API_BASE: ${API_BASE}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  // 1) List endpoints — vendors-only envelope
  const listCases = [
    ['by-style vet at_center', `${API_BASE}/customer/services/by-style?style=at_center&category=vet&roleId=veterinarian&limit=3&${loc}${phoneQ}`],
    ['by-style grooming at_center', `${API_BASE}/customer/services/by-style?style=at_center&category=grooming&limit=3&${loc}`],
    ['discover-services vet at_home', `${API_BASE}/customer/discover-services?category=vet&serviceStyle=at_home&limit=3&${loc}`],
    ['discover-services grooming at_home', `${API_BASE}/customer/discover-services?category=grooming&serviceStyle=at_home&limit=3&${loc}`],
  ];

  let sampleVendorId = null;
  for (const [name, url] of listCases) {
    const { res, json } = await getJson(url);
    if (res.status !== 200 || json.success === false) {
      fail(name, `status=${res.status} error=${json.error || 'unknown'}`);
      continue;
    }
    if ('providers' in json && Array.isArray(json.providers)) {
      fail(name, 'providers twin still present on list envelope');
    } else {
      pass(name, 'vendors-only envelope');
    }
    const vendors = json.vendors || [];
    if (vendors.length === 0) fail(name, 'zero vendors');
    else {
      pass(name, `vendors=${vendors.length}`);
      assertVendorCard(vendors[0], name);
      if (!sampleVendorId && name.includes('vet')) {
        sampleVendorId = vendors[0].vendorId || vendors[0].id;
      }
    }
    if (json.nextCursor) pass(`${name} cursor`, 'nextCursor present');
  }

  // 2) Cursor pagination round-trip (vet by-style)
  const page1Url = `${API_BASE}/customer/services/by-style?style=at_center&category=vet&roleId=veterinarian&limit=3&${loc}${phoneQ}`;
  const p1 = await getJson(page1Url);
  if (p1.json.nextCursor) {
    const p2 = await getJson(`${page1Url}&cursor=${encodeURIComponent(p1.json.nextCursor)}`);
    const ids1 = (p1.json.vendors || []).map((v) => v.id);
    const ids2 = (p2.json.vendors || []).map((v) => v.id);
    const overlap = ids1.filter((id) => ids2.includes(id));
    if (overlap.length) fail('cursor pagination', `duplicate ids: ${overlap.join(',')}`);
    else pass('cursor pagination', `page1=${ids1.length} page2=${ids2.length}`);
  } else {
    pass('cursor pagination', 'skipped (no nextCursor — total <= limit)');
  }

  // 3) category-bootstrap
  for (const q of [
    ['bootstrap vet', 'category=vet&roleId=vet'],
    ['bootstrap grooming', 'category=grooming&roleId=groomer'],
    ['bootstrap training', 'category=training&roleId=trainer'],
  ]) {
    const { res, json } = await getJson(`${API_BASE}/customer/discovery/category-bootstrap?${q[1]}`);
    if (res.status !== 200 || json.success === false) fail(q[0], json.error || res.status);
    else pass(q[0], `styles=${json.styles?.length ?? 0} problems=${json.problems?.length ?? 0}`);
  }

  // 4) vendor-services lazy load (card + legacy)
  if (sampleVendorId) {
    const cardUrl = `${API_BASE}/customer/vendor/${sampleVendorId}/services?serviceStyle=at_center&category=vet&limit=5${phoneQ ? phoneQ.replace('&', '&') : ''}${PHONE ? '' : ''}`;
    const cardPhone = PHONE ? `&customerPhone=${encodeURIComponent(PHONE)}` : '';
    const card = await getJson(
      `${API_BASE}/customer/vendor/${sampleVendorId}/services?serviceStyle=at_center&category=vet&limit=5${cardPhone}`
    );
    if (card.res.status !== 200 || card.json.success === false) {
      fail('vendor-services card', card.json.error || card.res.status);
    } else if (String(card.json.error || '').includes('not defined')) {
      fail('vendor-services card', card.json.error);
    } else {
      const n = (card.json.services || []).length;
      pass('vendor-services card', `services=${n}`);
      if (card.json.nextCursor != null) pass('vendor-services card', 'nextCursor field ok');
    }

    const legacy = await getJson(
      `${API_BASE}/customer/vendor/${sampleVendorId}/services?serviceStyle=at_center&category=vet${cardPhone}`
    );
    if (legacy.res.status !== 200 || legacy.json.success === false) {
      fail('vendor-services legacy', legacy.json.error || legacy.res.status);
    } else {
      pass('vendor-services legacy', `services=${(legacy.json.services || []).length}`);
    }
  } else {
    fail('vendor-services', 'no sample vendor id from list');
  }

  console.log(`\n---\nPassed: ${passed} | Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
