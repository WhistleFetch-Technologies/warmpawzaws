#!/usr/bin/env node
/**
 * Apply Admin geo launch configuration directly to platform_settings (RDS).
 * Use when dev API lacks serviceStyle support on PUT /config/service-launch/geography,
 * or for idempotent bulk apply of the plan:
 *   - Tele: All India launched
 *   - At Center / At Home: hidden default, launched in launch cities only
 *   - Shop: All India launched (clears blocking state overrides)
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/apply-geo-launch-direct-rds.js
 *   DRY_RUN=1 ENVIRONMENT=dev node scripts/apply-geo-launch-direct-rds.js
 */

const { Client } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const SETTING_KEY = 'platform:service-launch-config';

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.API_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

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

const CITY_ALIASES = {
  bengaluru: 'Bangalore',
  bangalore: 'Bangalore',
  mumbai: 'Mumbai',
  bombay: 'Mumbai',
};

function normalizeCity(city) {
  const t = String(city || '').trim();
  if (!t) return '';
  return CITY_ALIASES[t.toLowerCase()] || t;
}

function applyGeographyUpdateToSlice(slice, stateCode, city, status, rolloutPercentage) {
  const next = { ...(slice || {}) };
  if (!stateCode) {
    next.defaultStatus = status;
    next.defaultRolloutPercentage = rolloutPercentage;
    return next;
  }
  if (!next.stateOverrides) next.stateOverrides = {};
  if (!next.stateOverrides[stateCode]) next.stateOverrides[stateCode] = { cities: {} };
  if (!city) {
    next.stateOverrides[stateCode] = {
      ...next.stateOverrides[stateCode],
      status,
      rolloutPercentage,
      cities: next.stateOverrides[stateCode].cities || {},
    };
    return next;
  }
  const citiesMap = { ...(next.stateOverrides[stateCode].cities || {}) };
  const cityKey = normalizeCity(city) || city;
  for (const k of Object.keys(citiesMap)) {
    if (k !== cityKey && normalizeCity(k) === cityKey) delete citiesMap[k];
  }
  citiesMap[cityKey] = { status, rolloutPercentage };
  next.stateOverrides[stateCode] = { ...next.stateOverrides[stateCode], cities: citiesMap };
  return next;
}

function ensureService(config, serviceId) {
  if (!config[serviceId]) {
    config[serviceId] = {
      serviceId,
      defaultStatus: 'hidden',
      defaultRolloutPercentage: 0,
      stateOverrides: {},
      createdAt: new Date().toISOString(),
    };
  }
  if (!config[serviceId].stateOverrides) config[serviceId].stateOverrides = {};
  return config[serviceId];
}

function applyStyleUpdate(service, styleKey, stateCode, city, status) {
  if (!service.styleOverrides) service.styleOverrides = {};
  const slice = service.styleOverrides[styleKey] || {};
  service.styleOverrides[styleKey] = applyGeographyUpdateToSlice(
    slice,
    stateCode,
    city,
    status,
    100
  );
}

function isLaunchCity(stateCode, city) {
  return LAUNCH_CITIES.some((lc) => lc.stateCode === stateCode && lc.city === city);
}

function auditParentOverrides(serviceId, service) {
  let fixes = 0;
  for (const [stateCode, stateCfg] of Object.entries(service.stateOverrides || {})) {
    for (const [city, cityCfg] of Object.entries(stateCfg.cities || {})) {
      if (cityCfg.status === 'launched' && !isLaunchCity(stateCode, city)) {
        console.log(`  audit: ${serviceId} parent ${stateCode}/${city} launched → hidden`);
        service.stateOverrides[stateCode] = {
          ...stateCfg,
          cities: {
            ...(stateCfg.cities || {}),
            [city]: { status: 'hidden', rolloutPercentage: 100 },
          },
        };
        fixes++;
      }
    }
  }
  return fixes;
}

function buildConfig(existing) {
  const config = { ...(existing || {}) };
  let changes = 0;

  console.log('\n=== Style services: parent + tele + clinic/home ===');
  for (const [serviceId, styles] of Object.entries(STYLE_SERVICES)) {
    const svc = ensureService(config, serviceId);
    if (svc.defaultStatus !== 'launched') {
      svc.defaultStatus = 'launched';
      svc.defaultRolloutPercentage = 100;
      changes++;
    }
    for (const style of styles) {
      if (style === 'tele') {
        applyStyleUpdate(svc, 'tele', undefined, undefined, 'launched');
        changes++;
        console.log(`  ${serviceId}.tele → All India launched`);
      } else {
        applyStyleUpdate(svc, style, undefined, undefined, 'hidden');
        for (const { stateCode, city } of LAUNCH_CITIES) {
          applyStyleUpdate(svc, style, stateCode, city, 'launched');
          console.log(`  ${serviceId}.${style} → ${city} launched`);
        }
        changes++;
      }
    }
    svc.updatedAt = new Date().toISOString();
    changes += auditParentOverrides(serviceId, svc);
  }

  console.log('\n=== Shop: All India launched ===');
  const shop = ensureService(config, 'shop');
  shop.defaultStatus = 'launched';
  shop.defaultRolloutPercentage = 100;
  shop.stateOverrides = {};
  shop.updatedAt = new Date().toISOString();
  console.log('  shop parent → launched, stateOverrides cleared');
  changes++;

  return { config, changes };
}

async function getDbClient() {
  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : 'warmpawz-dev-rds-master-20260106164510791100000002';
  const host =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com'
      : 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const credentials = JSON.parse(secretValue.SecretString);

  const client = new Client({
    host,
    port: 5432,
    database: 'warmpawz',
    user: credentials.username || credentials.user,
    password: credentials.password,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function verifyCustomerFlows() {
  console.log('\n=== Verify customer API ===');
  const cases = [
    { label: 'Mumbai', state: 'Maharashtra', city: 'Mumbai', launch: true },
    { label: 'Bangalore', state: 'Karnataka', city: 'Bangalore', launch: true },
    { label: 'Pune', state: 'Maharashtra', city: 'Pune', launch: false },
    { label: 'Mysore', state: 'Karnataka', city: 'Mysore', launch: false },
  ];

  let passed = 0;
  let failed = 0;

  for (const { label, state, city, launch } of cases) {
    const params = new URLSearchParams({ state, city });
    const res = await fetch(`${API_BASE}/config/service-launch/customer?${params}`);
    const json = await res.json();
    const vet = json.services?.catalog?.find((s) => s.serviceId === 'vet');
    const shop = json.services?.catalog?.find((s) => s.serviceId === 'shop');
    const styles = vet?.effectiveStyles || {};
    const tele = styles.tele?.effectiveStatus;
    const center = styles.at_center?.effectiveStatus;
    const home = styles.at_home?.effectiveStatus;

    const checks = [
      ['vet parent launched', vet?.effectiveStatus === 'launched'],
      ['tele launched', tele === 'launched' || tele === undefined],
      ['at_center', launch ? center === 'launched' : center === 'hidden' || center === undefined],
      ['at_home', launch ? home === 'launched' : home === 'hidden' || home === undefined],
      ['shop launched', shop?.effectiveStatus === 'launched'],
    ];

    console.log(`\n  ${label}:`);
    for (const [name, ok] of checks) {
      const styleNote =
        name === 'tele' || name === 'at_center' || name === 'at_home'
          ? `(styles API ${tele === undefined ? 'not deployed yet' : 'ok'})`
          : '';
      console.log(`    ${ok ? '✅' : '❌'} ${name} ${styleNote}`);
      if (ok) passed++;
      else failed++;
    }
  }

  console.log(`\nVerification: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

async function main() {
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Launch cities: ${LAUNCH_CITIES.map((c) => c.city).join(', ')}`);
  if (DRY_RUN) console.log('DRY_RUN — no DB write');

  const client = await getDbClient();
  console.log('✅ Connected to RDS');

  try {
    const existingRes = await client.query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = $1`,
      [SETTING_KEY]
    );
    let existing = {};
    if (existingRes.rows.length > 0) {
      const raw = existingRes.rows[0].setting_value;
      existing = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }

    const { config, changes } = buildConfig(existing);
    console.log(`\nPrepared ${changes} configuration update(s)`);

    if (!DRY_RUN) {
      if (existingRes.rows.length > 0) {
        await client.query(
          `UPDATE platform_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2`,
          [JSON.stringify(config), SETTING_KEY]
        );
      } else {
        await client.query(
          `INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
           VALUES ($1, $2, 'object', 'Service launch configuration by geography', NOW(), NOW())`,
          [SETTING_KEY, JSON.stringify(config)]
        );
      }
      console.log('✅ platform_settings updated');
    }

    if (!DRY_RUN) await verifyCustomerFlows();
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
