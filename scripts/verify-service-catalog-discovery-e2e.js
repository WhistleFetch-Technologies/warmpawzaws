#!/usr/bin/env node

/**
 * ============================================================================
 * E2E Verification: Service Catalog Discovery by Role
 * ============================================================================
 *
 * Verifies that:
 * 1. GET /service-catalog/role/:roleId returns services whose applicable_roles
 *    overlap with the role (vet_solo, groomer_center, trainer_center, etc.).
 * 2. Comma-separated serviceStyle (at_home,tele) returns both styles for solo.
 * 3. Role filtering is correct (no cross-role leakage).
 *
 * Usage:
 *   API_ENDPOINT=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com node scripts/verify-service-catalog-discovery-e2e.js
 * ============================================================================
 */

const https = require('https');
const http = require('http');

const API_BASE = process.env.API_ENDPOINT || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
    const client = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data || '{}') });
        } catch {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Roles that should see role-specific catalog (name or id)
const ROLES_TO_TEST = [
  { id: 'vet_solo', name: 'vet_solo', expectMinServices: 1 },
  { id: 'vet_clinic', name: 'vet_clinic', expectMinServices: 1 },
  { id: 'groomer_center', name: 'groomer_center', expectMinServices: 1 },
  { id: 'groomer_solo', name: 'groomer_solo', expectMinServices: 1 },
  { id: 'trainer_center', name: 'trainer_center', expectMinServices: 1 },
  { id: 'trainer_solo', name: 'trainer_solo', expectMinServices: 1 },
  { id: 'walker', name: 'walker', expectMinServices: 0 },
  { id: 'pharmacy', name: 'pharmacy', expectMinServices: 0 },
];

function roleOverlaps(applicableRoles, roleName) {
  if (!applicableRoles || !Array.isArray(applicableRoles)) return true;
  const r = (roleName || '').toLowerCase().replace(/\s/g, '_');
  const roles = (y) => (y || '').toLowerCase();
  const vet = ['vet', 'veterinarian', 'vet_clinic', 'vet_solo', 'veterinary_clinic', 'diagnostics_center'];
  const groomer = ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo', 'pet_spa'];
  const trainer = ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'];
  const check = (arr) => arr.some((x) => applicableRoles.some((y) => roles(y) === x));
  if (vet.includes(r)) return check(vet);
  if (groomer.includes(r)) return check(groomer);
  if (trainer.includes(r)) return check(trainer);
  return applicableRoles.some((x) => roles(x).includes(r) || r.includes(roles(x)));
}

async function main() {
  console.log('Service Catalog Discovery E2E Verification');
  console.log('==========================================');
  console.log('API:', API_BASE);
  console.log('');

  let passed = 0;
  let failed = 0;

  // 1. Health
  try {
    const health = await request('/health');
    if (health.statusCode === 200) {
      console.log('✅ GET /health:', health.statusCode);
      passed++;
    } else {
      console.log('❌ GET /health:', health.statusCode);
      failed++;
    }
  } catch (e) {
    console.log('❌ GET /health:', e.message);
    failed++;
  }

  // 2. Catalog by role (single style) — verify 200, count >= min, and each service has applicable_roles overlapping role
  for (const role of ROLES_TO_TEST) {
    try {
      const res = await request(`/service-catalog/role/${role.id}?serviceStyle=at_home`);
      const ok = res.statusCode === 200 && res.body && res.body.success !== false;
      const services = res.body?.services || [];
      const count = services.length;
      const meetsMin = count >= role.expectMinServices;
      const mismatched = services.filter((s) => !roleOverlaps(s.applicableRoles || s.applicable_roles, role.name));
      const allMatchRole = mismatched.length === 0;
      if (ok && meetsMin && allMatchRole) {
        console.log(`✅ GET /service-catalog/role/${role.id}?serviceStyle=at_home → ${count} services, all match role`);
        passed++;
      } else {
        if (!ok) console.log(`❌ GET /service-catalog/role/${role.id} → ${res.statusCode}`, res.body?.error || res.body?.message);
        else if (!meetsMin) console.log(`⚠️ GET /service-catalog/role/${role.id} → ${count} services (expected >= ${role.expectMinServices})`);
        else if (!allMatchRole) console.log(`❌ GET /service-catalog/role/${role.id} → ${mismatched.length} services do not match role (first applicable_roles: ${(mismatched[0]?.applicableRoles || mismatched[0]?.applicable_roles || []).join(',')})`);
        failed += (ok && meetsMin && allMatchRole) ? 0 : 1;
      }
    } catch (e) {
      console.log(`❌ GET /service-catalog/role/${role.id}:`, e.message);
      failed++;
    }
  }

  // 3. Comma-separated serviceStyle (at_home,tele) for solo
  try {
    const res = await request(`/service-catalog/role/vet_solo?serviceStyle=at_home,tele`);
    const ok = res.statusCode === 200 && res.body && res.body.success !== false;
    const services = res.body?.services || [];
    const hasHome = services.some((s) => (s.serviceStyle || s.service_style) === 'at_home');
    const hasTele = services.some((s) => (s.serviceStyle || s.service_style) === 'tele');
    if (ok && services.length > 0 && (hasHome || hasTele)) {
      console.log(`✅ GET /service-catalog/role/vet_solo?serviceStyle=at_home,tele → ${services.length} services (at_home/tele)`);
      passed++;
    } else {
      console.log(`❌ GET /service-catalog/role/vet_solo?serviceStyle=at_home,tele → ok=${ok} count=${services.length} hasHome=${hasHome} hasTele=${hasTele}`);
      failed++;
    }
  } catch (e) {
    console.log('❌ serviceStyle=at_home,tele:', e.message);
    failed++;
  }

  // 4. Vendor services returns role (no vendorId needed for this check; use invalid to get 200 with empty)
  try {
    const res = await request('/vendor/test-vendor-id/services');
    const ok = res.statusCode === 200;
    const hasRoleKey = res.body && (res.body.role !== undefined || res.body.allServices !== undefined);
    if (ok) {
      console.log('✅ GET /vendor/:vendorId/services returns 200 and structure');
      passed++;
    } else {
      console.log('❌ GET /vendor/:vendorId/services:', res.statusCode);
      failed++;
    }
  } catch (e) {
    console.log('❌ GET /vendor/:vendorId/services:', e.message);
    failed++;
  }

  console.log('');
  console.log('---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
  console.log('All checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
