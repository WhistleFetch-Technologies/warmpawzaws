#!/usr/bin/env node
/**
 * Post-deploy release verification for Commerce Switch (read-only HTTP checks).
 * Does NOT require admin auth. Does NOT assert activeModelId=marketplace (unlike smoke).
 *
 * Usage:
 *   node scripts/commerce-switch-release-verify.js [baseUrl]
 *   API_BASE_URL=https://... npm run release-verify:commerce-switch
 */
const base = (
  process.argv[2] ||
  process.env.API_BASE_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com'
).replace(/\/+$/, '');

const VALID_MODELS = new Set(['marketplace', 'warmpawz_pay']);

let failures = 0;

function fail(msg) {
  console.error('FAIL', msg);
  failures += 1;
}

function pass(msg, detail) {
  console.log('PASS', msg, detail ?? '');
}

async function fetchJson(path) {
  const url = `${base}${path}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  return { url, res, body };
}

function validatePublicConfig(body) {
  if (body.success !== true) {
    fail('GET /config/commerce-switch: success !== true');
    return;
  }
  if (typeof body.activeModelId !== 'string' || !VALID_MODELS.has(body.activeModelId)) {
    fail(`GET /config/commerce-switch: invalid activeModelId=${body.activeModelId}`);
    return;
  }
  if (typeof body.version !== 'number' || body.version < 1) {
    fail(`GET /config/commerce-switch: invalid version=${body.version}`);
    return;
  }
  if (typeof body.schemaVersion !== 'string' || !body.schemaVersion) {
    fail('GET /config/commerce-switch: missing schemaVersion');
    return;
  }
  if (!Array.isArray(body.availableModels) || body.availableModels.length < 1) {
    fail('GET /config/commerce-switch: availableModels must be non-empty array');
    return;
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) {
    fail('GET /config/commerce-switch: missing updatedAt');
    return;
  }
  pass('GET /config/commerce-switch', {
    activeModelId: body.activeModelId,
    version: body.version,
    degraded: body.degraded === true,
  });
}

async function main() {
  console.log('Commerce Switch release verify —', base);

  const config = await fetchJson('/config/commerce-switch');
  if (!config.res.ok) {
    fail(`GET /config/commerce-switch HTTP ${config.res.status}`);
  } else {
    validatePublicConfig(config.body);
  }

  const health = await fetchJson('/config/commerce-switch/health');
  if (!health.res.ok) {
    fail(`GET /config/commerce-switch/health HTTP ${health.res.status}`);
  } else if (health.body.success !== true || health.body.status !== 'ok') {
    fail('GET /config/commerce-switch/health: unexpected body');
  } else if (typeof health.body.configurationVersion !== 'number') {
    fail('GET /config/commerce-switch/health: missing configurationVersion');
  } else {
    pass('GET /config/commerce-switch/health', {
      configurationVersion: health.body.configurationVersion,
      cacheAgeMs: health.body.cacheAgeMs,
    });
  }

  if (failures > 0) {
    console.error(`\nRelease verify FAILED (${failures} check(s))`);
    process.exit(1);
  }

  console.log('\nRelease verify OK — run manual governance/admin checks per commerce-switch-release-order.sh');
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
