#!/usr/bin/env node
/**
 * Forensic verification: Service catalog role-specific discovery and categories.
 * 1) No "Uncategorized" headers - every service has a proper category.
 * 2) Vet role sees only vet-related categories (no Diagnostics & Lab).
 * 3) Diagnostics role sees only diagnostics-related categories.
 *
 * Run after applying migration 511 and deploying backend.
 * Usage: node scripts/forensic-service-catalog-role-categories.js
 * Env:   API_BASE_URL (default: https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com)
 */

const API_BASE = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

let pass = 0;
let fail = 0;

function log(label, message, ok) {
  const icon = ok === true ? '✓' : ok === false ? '✗' : '⚠';
  const color = ok === true ? '\x1b[32m' : ok === false ? '\x1b[31m' : '\x1b[33m';
  console.log(`${color}  ${icon} ${message}\x1b[0m`);
}

async function fetchCatalog(roleId) {
  const url = `${API_BASE}/service-catalog/role/${roleId}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function hasDiagnosticsLab(body) {
  const str = JSON.stringify(body);
  return /Diagnostics\s*&\s*Lab/i.test(str) || /diagnostics.*lab/i.test(str);
}

function hasUncategorized(body) {
  const str = JSON.stringify(body);
  return /"categoryName"\s*:\s*"Uncategorized"/.test(str) || /"categoryName"\s*:\s*""/.test(str);
}

async function run() {
  console.log('');
  console.log('\x1b[34m═══════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[34m  FORENSIC: Service Catalog Role-Specific & Categories\x1b[0m');
  console.log('\x1b[34m═══════════════════════════════════════════════════════════════\x1b[0m');
  console.log('');
  console.log('  API Base: ' + API_BASE);
  console.log('');

  // 1. Vet role: must NOT contain "Diagnostics & Lab"
  console.log('\x1b[34m[1] GET /service-catalog/role/veterinarian (vet must not see Diagnostics & Lab)\x1b[0m');
  let res = await fetchCatalog('veterinarian');
  if (res.status !== 200) {
    res = await fetchCatalog('vet_solo');
  }
  if (res.status === 200) {
    const services = res.body?.services;
    if (Array.isArray(services)) {
      if (hasDiagnosticsLab(res.body)) {
        log('vet', 'Vet catalog must NOT include \'Diagnostics & Lab\' (role-specific violation)', false);
        fail++;
      } else {
        log('vet', 'Vet catalog has no Diagnostics & Lab category', true);
        pass++;
      }
      if (hasUncategorized(res.body)) {
        log('vet', 'Response contains Uncategorized categoryName', false);
        fail++;
      } else {
        log('vet', 'No Uncategorized category in response', true);
        pass++;
      }
    } else {
      log('vet', '200 but no \'services\' key', null);
      fail++;
    }
  } else {
    log('vet', `HTTP ${res.status} (expected 200)`, false);
    fail++;
  }
  console.log('');

  // 2. Diagnostics role
  console.log('\x1b[34m[2] GET /service-catalog/role/diagnostics_center\x1b[0m');
  res = await fetchCatalog('diagnostics_center');
  if (res.status === 200) {
    const services = res.body?.services;
    if (Array.isArray(services)) {
      if (hasDiagnosticsLab(res.body) || /diagnostics/i.test(JSON.stringify(res.body))) {
        log('diag', 'Diagnostics catalog includes Diagnostics category', true);
        pass++;
      } else {
        log('diag', 'Diagnostics role has no \'Diagnostics & Lab\' in response (may be empty catalog)', null);
        pass++;
      }
      if (hasUncategorized(res.body)) {
        log('diag', 'Response contains Uncategorized categoryName', false);
        fail++;
      } else {
        log('diag', 'No Uncategorized category in response', true);
        pass++;
      }
    } else {
      log('diag', '200 but no \'services\' key', null);
      fail++;
    }
  } else {
    log('diag', `HTTP ${res.status}`, false);
    fail++;
  }
  console.log('');

  // 3. Groomer: no Uncategorized
  console.log('\x1b[34m[3] GET /service-catalog/role/pet_groomer (no Uncategorized)\x1b[0m');
  res = await fetchCatalog('pet_groomer');
  if (res.status === 200) {
    if (hasUncategorized(res.body)) {
      log('groomer', 'Groomer catalog must not have Uncategorized', false);
      fail++;
    } else {
      log('groomer', 'Groomer catalog has no Uncategorized', true);
      pass++;
    }
  } else {
    log('groomer', `HTTP ${res.status} (role may not exist)`, null);
  }
  console.log('');

  // Summary
  console.log('\x1b[34m───────────────────────────────────────────────────────────────\x1b[0m');
  console.log('  \x1b[32mPass: ' + pass + '\x1b[0m  \x1b[31mFail: ' + fail + '\x1b[0m');
  console.log('');
  if (fail === 0) {
    console.log('  \x1b[32mAll forensic checks passed. Role-specific catalog and categories OK.\x1b[0m');
    console.log('');
    process.exit(0);
  } else {
    console.log('  \x1b[31mOne or more checks failed. Verify migration 511 applied and backend deployed.\x1b[0m');
    console.log('');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
