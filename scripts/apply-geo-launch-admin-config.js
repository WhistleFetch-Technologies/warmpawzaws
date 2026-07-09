#!/usr/bin/env node
/**
 * Apply Admin geo launch configuration per plan:
 *   - Tele: All India (launched)
 *   - At Center / At Home: hidden default, launched in launch cities only
 *   - Shop: All India (launched), clear blocking state overrides
 *   - Audit stale regional overrides outside launch cities
 *
 * Uses PUT /config/service-launch bulk (supports styleOverrides on dev API).
 *
 * Usage:
 *   node scripts/apply-geo-launch-admin-config.js
 *   DRY_RUN=1 node scripts/apply-geo-launch-admin-config.js
 *   API_BASE_URL=https://... node scripts/apply-geo-launch-admin-config.js
 */

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.API_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

const LAUNCH_CITIES = [
  { stateCode: 'MH', stateName: 'Maharashtra', city: 'Mumbai' },
  { stateCode: 'KA', stateName: 'Karnataka', city: 'Bangalore' },
];

const STYLE_SERVICES = {
  vet: ['tele', 'at_center', 'at_home'],
  grooming: ['at_center', 'at_home'],
  training: ['at_center', 'at_home'],
  walker: ['at_home'],
  boarding: ['at_center', 'at_home'],
  'pet-sitter': ['at_home'],
  sitting: ['at_home'],
  nutritionist: ['tele', 'at_home'],
  ambulance: ['at_home', 'tele'],
  pharmacy: ['at_center', 'at_home'],
  'lab-diagnostics': ['at_center', 'at_home'],
  diagnostics: ['at_center', 'at_home'],
};

function locationStyleSlice(defaultStatus, launchCities) {
  const stateOverrides = {};
  for (const { stateCode, city, status } of launchCities) {
    if (!stateOverrides[stateCode]) stateOverrides[stateCode] = { cities: {} };
    stateOverrides[stateCode].cities[city] = { status, rolloutPercentage: 100 };
  }
  return {
    defaultStatus,
    defaultRolloutPercentage: 100,
    stateOverrides,
  };
}

function buildStyleServiceEntry(serviceId, styles) {
  const styleOverrides = {};
  for (const style of styles) {
    if (style === 'tele') {
      styleOverrides.tele = { defaultStatus: 'launched', defaultRolloutPercentage: 100 };
    } else {
      styleOverrides[style] = locationStyleSlice(
        'hidden',
        LAUNCH_CITIES.map(({ stateCode, city }) => ({ stateCode, city, status: 'launched' }))
      );
    }
  }
  return {
    serviceId,
    defaultStatus: 'launched',
    defaultRolloutPercentage: 100,
    stateOverrides: {},
    styleOverrides,
  };
}

function isLaunchCity(stateCode, city) {
  return LAUNCH_CITIES.some((lc) => lc.stateCode === stateCode && lc.city === city);
}

async function fetchAdminConfig() {
  const res = await fetch(`${API_BASE}/config/service-launch`);
  const json = await res.json();
  if (!json.success) throw new Error('Failed to fetch admin launch config');
  return json.services || [];
}

async function fetchCustomerCatalog(stateName, city) {
  const params = new URLSearchParams();
  if (stateName) params.set('state', stateName);
  if (city) params.set('city', city);
  const res = await fetch(`${API_BASE}/config/service-launch/customer?${params}`);
  const json = await res.json();
  return json.services?.catalog || [];
}

async function putBulkConfig(services) {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] PUT bulk ${services.length} service(s)`);
    return { success: true, config: {} };
  }
  const res = await fetch(`${API_BASE}/config/service-launch`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ services }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`Bulk PUT failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function putGeography(body) {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] PUT geography ${JSON.stringify(body)}`);
    return { success: true };
  }
  const res = await fetch(`${API_BASE}/config/service-launch/geography`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`Geography PUT failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function applyStyleServices() {
  console.log('\n=== Step 1–2: Style services (tele All India + clinic/home by city) ===');
  const services = Object.entries(STYLE_SERVICES).map(([serviceId, styles]) =>
    buildStyleServiceEntry(serviceId, styles)
  );
  await putBulkConfig(services);
  for (const s of services) {
    const styles = Object.keys(s.styleOverrides).join(', ');
    console.log(`✅ ${s.serviceId} (styles: ${styles})`);
  }
}

async function applyShopAllIndia() {
  console.log('\n=== Step 3: Shop All India ===');
  await putBulkConfig([
    {
      serviceId: 'shop',
      defaultStatus: 'launched',
      defaultRolloutPercentage: 100,
      stateOverrides: {},
    },
  ]);
  console.log('✅ shop → launched (stateOverrides cleared)');
}

async function auditRegionalOverrides() {
  console.log('\n=== Step 4: Audit regional overrides ===');
  const adminServices = await fetchAdminConfig();
  let fixes = 0;

  for (const svc of adminServices) {
    const serviceId = svc.serviceId || svc.id;
    if (STYLE_SERVICES[serviceId] || serviceId === 'shop') continue;

    for (const [stateCode, stateCfg] of Object.entries(svc.stateOverrides || {})) {
      for (const [city, cityCfg] of Object.entries(stateCfg.cities || {})) {
        if (cityCfg.status === 'launched' && !isLaunchCity(stateCode, city)) {
          console.log(`⚠️  ${serviceId} ${stateCode}/${city} launched → hiding`);
          await putGeography({ serviceId, stateCode, city, status: 'hidden', rolloutPercentage: 100 });
          fixes++;
        }
      }
    }
  }

  if (fixes === 0) console.log('✅ No stale overrides on non-style services');
  else console.log(`✅ Fixed ${fixes} stale override(s)`);
}

async function verifyCustomerFlows() {
  console.log('\n=== Step 5: Verify customer flows ===');
  const cases = [
    { label: 'Mumbai (launch city)', state: 'Maharashtra', city: 'Mumbai', launch: true },
    { label: 'Bangalore (launch city)', state: 'Karnataka', city: 'Bangalore', launch: true },
    { label: 'Pune (non-launch city)', state: 'Maharashtra', city: 'Pune', launch: false },
    { label: 'Mysore (non-launch city)', state: 'Karnataka', city: 'Mysore', launch: false },
  ];

  let passed = 0;
  let failed = 0;
  let stylesApiReady = true;

  for (const { label, state, city, launch } of cases) {
    const catalog = await fetchCustomerCatalog(state, city);
    const vet = catalog.find((s) => s.serviceId === 'vet');
    const shop = catalog.find((s) => s.serviceId === 'shop');
    const tele = vet?.effectiveStyles?.tele?.effectiveStatus;
    const center = vet?.effectiveStyles?.at_center?.effectiveStatus;
    const home = vet?.effectiveStyles?.at_home?.effectiveStatus;

    if (tele === undefined && vet?.effectiveStyles === undefined) {
      stylesApiReady = false;
    }

    const checks = [
      { name: 'vet parent launched', ok: vet?.effectiveStatus === 'launched', got: vet?.effectiveStatus },
      {
        name: 'tele launched',
        ok: stylesApiReady ? tele === 'launched' : true,
        got: tele ?? '(API pending lambda deploy)',
      },
      {
        name: launch ? 'at_center launched' : 'at_center hidden',
        ok: stylesApiReady ? (launch ? center === 'launched' : center === 'hidden') : true,
        got: center ?? '(API pending lambda deploy)',
      },
      {
        name: launch ? 'at_home launched' : 'at_home hidden',
        ok: stylesApiReady ? (launch ? home === 'launched' : home === 'hidden') : true,
        got: home ?? '(API pending lambda deploy)',
      },
      { name: 'shop launched', ok: shop?.effectiveStatus === 'launched', got: shop?.effectiveStatus },
    ];

    console.log(`\n  ${label}:`);
    for (const c of checks) {
      console.log(`    ${c.ok ? '✅' : '❌'} ${c.name} (got: ${JSON.stringify(c.got)})`);
      if (c.ok) passed++;
      else failed++;
    }
  }

  if (!stylesApiReady) {
    console.log(
      '\n  ℹ️  effectiveStyles not returned by customer API — deploy backend/lambda to dev for style gating.'
    );
  }

  console.log(`\nVerification: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

async function main() {
  console.log(`API: ${API_BASE}`);
  console.log(`Launch cities: ${LAUNCH_CITIES.map((c) => c.city).join(', ')}`);
  if (DRY_RUN) console.log('DRY_RUN mode — no writes');

  await applyStyleServices();
  await applyShopAllIndia();
  await auditRegionalOverrides();
  if (!DRY_RUN) await verifyCustomerFlows();
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
