#!/usr/bin/env node
/**
 * Smoke test for GET /config/commerce-switch against dev API.
 * Usage: node scripts/commerce-switch-smoke.js [baseUrl]
 */
const base =
  (process.argv[2] || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com').replace(
    /\/+$/,
    ''
  );

async function main() {
  const url = `${base}/config/commerce-switch`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('FAIL', res.status, body);
    process.exit(1);
  }
  if (body.activeModelId !== 'marketplace') {
    console.error('FAIL expected activeModelId=marketplace got', body.activeModelId);
    process.exit(1);
  }
  console.log('PASS commerce-switch smoke', { activeModelId: body.activeModelId, version: body.version });
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
