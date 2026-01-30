#!/usr/bin/env node
/**
 * Forensic verification check – entry points, imports, API paths.
 * Run from repo root: node scripts/forensic-verification-check.js
 * See docs/FORENSIC_CODE_VERIFICATION_REPORT.md for full report.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'dist_backup', 'dist-export']);

function* walk(dir, ext) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !SKIP.has(e.name)) yield* walk(full, ext);
    else if (e.isFile() && (!ext || e.name.endsWith(ext))) yield full;
  }
}

const rel = (p) => path.relative(ROOT, p);

// 1) Entry points
const entryPoints = [
  'apps/admin-web/app/layout.tsx',
  'apps/admin-web/app/page.tsx',
  'apps/vendor-web/app/layout.tsx',
  'apps/vendor-web/app/page.tsx',
  'apps/customer-web/app/layout.tsx',
  'apps/customer-web/app/page.tsx',
  'Warmpawz Ecosystem Development/src/App.tsx',
  'backend/lambda/src/handler/index.ts',
];
console.log('=== 1. Entry points (exist?) ===');
for (const ep of entryPoints) {
  const exists = fs.existsSync(path.join(ROOT, ep));
  console.log(exists ? '  OK' : '  MISSING', ep);
}

// 2) api-config module – must exist where imported (no Supabase; use getApiBaseUrl/getAuthHeaders)
const appsVendorWeb = path.join(ROOT, 'apps/vendor-web');
const ecosystem = path.join(ROOT, 'Warmpawz Ecosystem Development/src');
const adminUi = path.join(ROOT, 'Admin UI');

const vendorWebApiConfig = path.join(appsVendorWeb, 'lib/api-config.ts');
const ecosystemApiConfig = path.join(ecosystem, 'utils/api-config.ts');
const adminUiApiConfig = path.join(adminUi, 'src/utils/api-config.ts');
console.log('\n=== 2. api-config module (API Gateway; no Supabase) ===');
console.log('  apps/vendor-web/lib/api-config.ts:', fs.existsSync(vendorWebApiConfig) ? 'OK' : 'MISSING');
console.log('  Warmpawz Ecosystem Development/src/utils/api-config.ts:', fs.existsSync(ecosystemApiConfig) ? 'OK' : 'MISSING');
console.log('  Admin UI/src/utils/api-config.ts:', fs.existsSync(adminUiApiConfig) ? 'OK' : 'MISSING (or @repo/utils/api-config alias)');

// 3) configRolesUrl usage – Ecosystem VendorRoleSelection must import it
const ecosystemVendorRole = path.join(ROOT, 'Warmpawz Ecosystem Development/src/components/vendor/VendorRoleSelection.tsx');
if (fs.existsSync(ecosystemVendorRole)) {
  const content = fs.readFileSync(ecosystemVendorRole, 'utf8');
  const hasConfigRolesUrl = content.includes('configRolesUrl');
  const importHasConfigRolesUrl = /import\s*\{[^}]*configRolesUrl/.test(content);
  console.log('\n=== 3. Ecosystem VendorRoleSelection (configRolesUrl) ===');
  console.log('  Uses configRolesUrl:', hasConfigRolesUrl ? 'OK' : 'MISSING');
  console.log('  Imports configRolesUrl:', importHasConfigRolesUrl ? 'OK' : 'MISSING');
}

// 4) Booking create paths – backend
const bookingsEnhanced = path.join(ROOT, 'backend/lambda/src/endpoints/bookings-enhanced.ts');
if (fs.existsSync(bookingsEnhanced)) {
  const content = fs.readFileSync(bookingsEnhanced, 'utf8');
  const paths = ['/bookings/create', '/booking/create', '/customer/booking/create', '/customer/bookings/create'];
  console.log('\n=== 4. Backend booking create paths ===');
  for (const p of paths) {
    console.log('  app.post("' + p + '"):', content.includes(`'${p}'`) || content.includes(`"${p}"`) ? 'OK' : 'MISSING');
  }
}

// 5) api-contracts usage in backend
const contractsIndex = path.join(ROOT, 'packages/api-contracts/src/index.ts');
console.log('\n=== 5. API contracts package ===');
console.log('  packages/api-contracts:', fs.existsSync(contractsIndex) ? 'OK' : 'MISSING');
const backendUsesContracts = [];
for (const f of walk(path.join(ROOT, 'backend/lambda/src'), '.ts')) {
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes('api-contracts') || c.includes('CreateBookingRequestSchema') || c.includes('@warmpawz/api-contracts')) backendUsesContracts.push(rel(f));
}
console.log('  Backend files using api-contracts or CreateBookingRequestSchema:', backendUsesContracts.length ? backendUsesContracts.slice(0, 5).join(', ') + (backendUsesContracts.length > 5 ? '...' : '') : 'NONE');

console.log('\nDone. See docs/FORENSIC_CODE_VERIFICATION_REPORT.md for full report.');
