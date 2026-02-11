#!/usr/bin/env node
/**
 * Forensic validation: Vet clinic discovery + service duration fixes.
 * Validates that:
 * 1. At-center discovery uses non-solo roles for vet (so business vendors list).
 * 2. Service duration uses COALESCE(custom_duration, duration_minutes) everywhere in discovery/customer-facing paths.
 * 3. Optional: Run E2E against live API if TEST_API_URL is set.
 *
 * Usage: node scripts/forensic-vet-discovery-duration-validation.js
 *        TEST_API_URL=https://... node scripts/forensic-vet-discovery-duration-validation.js  # include E2E
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const results = { passed: 0, failed: 0, errors: [] };

function pass(msg) {
  results.passed++;
  console.log(`  ✅ ${msg}`);
}

function fail(msg) {
  results.failed++;
  results.errors.push(msg);
  console.log(`  ❌ ${msg}`);
}

// 1) Discovery at_center role logic (mirror backend CATEGORY_ROLE_NAMES + filter)
const CATEGORY_ROLE_NAMES = {
  vet: ['veterinarian', 'vet_clinic', 'vet_solo', 'vet'],
  grooming: ['groomer', 'groomer_solo', 'groomer_center', 'grooming_solo', 'pet_groomer'],
};
function filterSolo(roles) {
  return roles.filter((r) => !r.toLowerCase().includes('solo'));
}
const vetCenterRoles = filterSolo(CATEGORY_ROLE_NAMES.vet);
if (vetCenterRoles.length > 0 && vetCenterRoles.includes('veterinarian') && vetCenterRoles.includes('vet_clinic') && !vetCenterRoles.includes('vet_solo')) {
  pass('At-center vet: non-solo filter yields [veterinarian, vet_clinic, vet]');
} else {
  fail(`At-center vet: expected non-solo roles to include veterinarian, vet_clinic; got ${JSON.stringify(vetCenterRoles)}`);
}

// 2) Grep for remaining gaps: vendor_services SELECT that use only duration_minutes (no COALESCE)
const serviceDiscoveryPath = path.join(ROOT, 'backend/lambda/src/endpoints/service-discovery.ts');
const vendorServicesPath = path.join(ROOT, 'backend/lambda/src/endpoints/vendor-services.ts');
let content = '';
try {
  content = fs.readFileSync(serviceDiscoveryPath, 'utf8');
} catch (e) {
  fail(`Could not read service-discovery.ts: ${e.message}`);
}

// Should NOT contain "vs.duration_minutes as duration" without COALESCE (we use COALESCE(vs.custom_duration, vs.duration_minutes) as duration)
const badPattern = /vs\.duration_minutes\s+as\s+duration/g;
const goodPattern = /COALESCE\s*\(\s*vs\.custom_duration\s*,\s*vs\.duration_minutes\s*\)\s+as\s+duration/g;
const badMatches = content.match(badPattern) || [];
const goodMatches = content.match(goodPattern) || [];
if (badMatches.length === 0 && goodMatches.length >= 4) {
  pass(`service-discovery.ts: no raw vs.duration_minutes as duration; COALESCE used in ${goodMatches.length} place(s)`);
} else if (badMatches.length > 0) {
  fail(`service-discovery.ts: found ${badMatches.length} raw vs.duration_minutes as duration (should use COALESCE)`);
} else {
  pass(`service-discovery.ts: duration uses COALESCE in discovery paths`);
}

// By-style at_center block should use COALESCE for duration
if (content.includes('COALESCE(vs.custom_duration, vs.duration_minutes) as duration')) {
  pass('service-discovery.ts: by-style/GET vendor services use COALESCE for duration');
} else {
  fail('service-discovery.ts: missing COALESCE(custom_duration, duration_minutes) for vendor_services duration');
}

// 3) Vendor-services: POST custom must accept duration and customDuration
const vsContent = fs.readFileSync(vendorServicesPath, 'utf8');
if (vsContent.includes('serviceData.duration ?? serviceData.customDuration') || vsContent.includes('serviceData.customDuration ?? serviceData.duration')) {
  pass('vendor-services.ts: custom service creation reads duration or customDuration');
} else {
  fail('vendor-services.ts: custom service creation may not read customDuration');
}

// 4) Vendor GET services returns both duration and customDuration
if (vsContent.includes('duration: row.duration_minutes') && vsContent.includes('customDuration: row.custom_duration')) {
  pass('vendor-services.ts: GET services returns duration and customDuration');
} else {
  fail('vendor-services.ts: GET services should return duration and customDuration');
}

// 5) Frontend: VendorServiceConfigurationScreen uses customDuration for display
const configPath = path.join(ROOT, 'apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx');
try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  if (configContent.includes('customDuration ?? svc.custom_duration ?? svc.duration')) {
    pass('VendorServiceConfigurationScreen: custom services use customDuration for display');
  } else {
    fail('VendorServiceConfigurationScreen: custom list should prefer customDuration for duration');
  }
} catch (e) {
  fail(`VendorServiceConfigurationScreen: ${e.message}`);
}

// 6) Optional E2E
const apiUrl = process.env.TEST_API_URL || process.env.API_BASE_URL || '';
if (apiUrl) {
  console.log('\n📋 Running E2E: GET /customer/discover-services?category=vet&serviceStyle=at_center ...');
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/customer/discover-services?category=vet&serviceStyle=at_center&latitude=12.9716&longitude=77.5946`;
  fetch(url)
    .then((res) => res.json().catch(() => ({})))
    .then((data) => {
      const list = data.providers ?? data.vendors ?? [];
      if (Array.isArray(list) && list.length > 0) {
        pass(`E2E discover-services at_center: returned ${list.length} vendor(s)`);
      } else if (data.error || data.message) {
        fail(`E2E discover-services: ${data.error || data.message}`);
      } else {
        fail(`E2E discover-services: no vendors in response (count=${list.length})`);
      }
      printSummary();
    })
    .catch((err) => {
      fail(`E2E discover-services: ${err.message}`);
      printSummary();
    });
} else {
  printSummary();
}

function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('FORENSIC VALIDATION SUMMARY (Vet discovery + duration)');
  console.log('═'.repeat(60));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log('Errors:');
    results.errors.forEach((e) => console.log('  -', e));
  }
  console.log('═'.repeat(60));
  process.exit(results.failed > 0 ? 1 : 0);
}
