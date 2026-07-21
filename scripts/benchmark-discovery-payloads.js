#!/usr/bin/env node
/**
 * Discovery payload benchmark — Phase 0 exit criteria.
 *
 * Usage:
 *   node scripts/benchmark-discovery-payloads.js
 *   API_BASE=https://... LAT=12.97 LNG=77.59 node scripts/benchmark-discovery-payloads.js
 *
 * Records status, raw bytes, gzip bytes, top-level keys, array lengths.
 */

const API_BASE =
  process.env.API_BASE || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const LAT = process.env.LAT || '12.9716';
const LNG = process.env.LNG || '77.5946';
const VENDOR_ID = process.env.VENDOR_ID || '';

async function fetchMetrics(url, init = {}) {
  const res = await fetch(url, init);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString('utf8');
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  const gzipRes = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), 'Accept-Encoding': 'gzip' },
  });
  const gzipBuf = Buffer.from(await gzipRes.arrayBuffer());

  const topKeys = json && typeof json === 'object' ? Object.keys(json) : [];
  const vendorsLen = Array.isArray(json?.vendors) ? json.vendors.length : null;
  const providersLen = Array.isArray(json?.providers) ? json.providers.length : null;
  const servicesLen = Array.isArray(json?.services) ? json.services.length : null;

  return {
    url,
    status: res.status,
    rawBytes: buf.length,
    gzipBytes: gzipBuf.length,
    topKeys,
    vendorsLen,
    providersLen,
    servicesLen,
    nextCursor: json?.nextCursor ?? null,
  };
}

function printRow(r) {
  console.log(
    [
      r.name.padEnd(28),
      String(r.status).padStart(3),
      String(r.rawBytes).padStart(8),
      String(r.gzipBytes).padStart(8),
      `v=${r.vendorsLen ?? '-'}`,
      `p=${r.providersLen ?? '-'}`,
      `s=${r.servicesLen ?? '-'}`,
      r.nextCursor ? 'cursor' : '-',
    ].join(' | ')
  );
}

async function main() {
  const loc = `latitude=${LAT}&longitude=${LNG}`;
  const scenarios = [
    {
      name: 'discover-services vet center',
      url: `${API_BASE}/customer/discover-services?category=vet&serviceStyle=at_center&limit=3&${loc}`,
    },
    {
      name: 'discover-services grooming home',
      url: `${API_BASE}/customer/discover-services?category=grooming&serviceStyle=at_home&limit=3&${loc}`,
    },
    {
      name: 'by-style vet center',
      url: `${API_BASE}/customer/services/by-style?style=at_center&category=vet&roleId=veterinarian&limit=3&${loc}`,
    },
    {
      name: 'by-style grooming center',
      url: `${API_BASE}/customer/services/by-style?style=at_center&category=grooming&roleId=pet_groomer&limit=3&${loc}`,
    },
    {
      name: 'category-bootstrap vet',
      url: `${API_BASE}/customer/discovery/category-bootstrap?category=vet&roleId=vet`,
    },
  ];

  if (VENDOR_ID) {
    scenarios.push(
      {
        name: 'vendor-services card',
        url: `${API_BASE}/customer/vendor/${VENDOR_ID}/services?category=vet&limit=5`,
      },
      {
        name: 'vendor-services legacy',
        url: `${API_BASE}/customer/vendor/${VENDOR_ID}/services?category=vet`,
      }
    );
  }

  console.log('Discovery payload benchmark');
  console.log(`API_BASE: ${API_BASE}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');
  console.log(
    ['name'.padEnd(28), 'st', 'rawB', 'gzipB', 'arrays', '', ''].join(' | ')
  );
  console.log('-'.repeat(90));

  const results = [];
  for (const s of scenarios) {
    try {
      const m = await fetchMetrics(s.url);
      const row = { name: s.name, ...m };
      results.push(row);
      printRow(row);
    } catch (e) {
      console.log(`${s.name.padEnd(28)} | ERROR: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log('');
  console.log('Copy summary rows into docs/benchmarks/discovery/README.md');
  if (!VENDOR_ID) {
    console.log('Tip: set VENDOR_ID=<uuid> to benchmark vendor-services card vs legacy.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
