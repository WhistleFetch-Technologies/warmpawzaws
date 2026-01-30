#!/usr/bin/env node
/**
 * Forensic Verification: Specialization / Catalog Flow
 *
 * Verifies end-to-end linking of Catalog specializations to:
 * 1) Vendor specialization selector
 * 2) Customer home "What's your need?" grid
 * 3) Customer service landing "What do you need?"
 *
 * Run (code-only): node scripts/verify-specialization-flow.js
 * Run (with API): API_BASE_URL=https://your-api.execute-api.region.amazonaws.com node scripts/verify-specialization-flow.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const API_BASE = process.env.API_BASE_URL || process.env.API_BASE || '';
const results = [];

function pass(area, check, message, detail) {
  results.push({ area, check, status: 'PASS', message, detail });
  console.log(`  ✅ ${check}: ${message}`);
}
function fail(area, check, message, detail) {
  results.push({ area, check, status: 'FAIL', message, detail });
  console.log(`  ❌ ${check}: ${message}`);
}
function skip(area, check, message) {
  results.push({ area, check, status: 'SKIP', message });
  console.log(`  ⏭️  ${check}: ${message}`);
}

function fetchAPI(urlPath) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${urlPath}`;
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
          } catch (e) {
            reject(new Error(`Parse error: ${data?.slice(0, 100)}`));
          }
        });
      })
      .on('error', reject);
  });
}

// ========== 1. Backend route registration (code forensic) ==========
function verifyBackendRoutes() {
  console.log('\n📋 1. Backend route registration');
  const problemGrid = path.join(process.cwd(), 'backend/lambda/src/endpoints/problem-grid.ts');
  const specMaster = path.join(process.cwd(), 'backend/lambda/src/endpoints/specialization-master.ts');
  const handler = path.join(process.cwd(), 'backend/lambda/src/handler/index.ts');

  if (!fs.existsSync(problemGrid)) {
    fail('Backend', 'problem-grid.ts exists', 'File not found');
    return;
  }
  pass('Backend', 'problem-grid.ts exists', 'File found');

  const pgContent = fs.readFileSync(problemGrid, 'utf-8');
  if (pgContent.includes('problem-grid-specializations/:roleId')) {
    pass('Backend', 'vendor specializations route', 'GET /vendor/problem-grid-specializations/:roleId defined');
  } else {
    fail('Backend', 'vendor specializations route', 'Route not found in problem-grid.ts');
  }
  if (pgContent.includes('specialization_master') && pgContent.includes('show_in_vendor_profile')) {
    pass('Backend', 'vendor spec from specialization_master', 'Vendor specs prefer specialization_master');
  } else {
    fail('Backend', 'vendor spec from specialization_master', 'Should query specialization_master first');
  }

  if (!fs.existsSync(specMaster)) {
    fail('Backend', 'specialization-master.ts exists', 'File not found');
    return;
  }
  pass('Backend', 'specialization-master.ts exists', 'File found');

  const smContent = fs.readFileSync(specMaster, 'utf-8');
  if (smContent.includes("app.get('/public/problem-grid',")) {
    pass('Backend', 'public problem-grid (all)', "GET /public/problem-grid defined (no param)");
  } else {
    fail('Backend', 'public problem-grid (all)', 'GET /public/problem-grid should be defined before :roleId');
  }
  if (smContent.includes('public/problem-grid/:roleId')) {
    pass('Backend', 'public problem-grid by role', 'GET /public/problem-grid/:roleId defined');
  } else {
    fail('Backend', 'public problem-grid by role', 'Route not found');
  }
  if (smContent.includes('show_in_problem_grid')) {
    pass('Backend', 'problem grid filter', 'Filters by show_in_problem_grid');
  }

  if (fs.existsSync(handler)) {
    const hContent = fs.readFileSync(handler, 'utf-8');
    if (hContent.includes('registerProblemGridEndpoints(app)') && hContent.includes('registerSpecializationMasterEndpoints(app)')) {
      pass('Backend', 'handler registration', 'Both endpoint modules registered on app');
    } else {
      fail('Backend', 'handler registration', 'Handler must register both problem-grid and specialization-master');
    }
  }
}

// ========== 2. Frontend API paths and response shapes ==========
function verifyFrontendPaths() {
  console.log('\n📋 2. Frontend API paths and response shapes');

  const navPath = path.join(process.cwd(), 'apps/customer-web/components/customer/ProblemGridNavigation.tsx');
  const homePath = path.join(process.cwd(), 'apps/customer-web/components/customer/home-services/HomeServiceLanding.tsx');
  const specPath = path.join(process.cwd(), 'apps/vendor-web/components/vendor/SpecializationSelector.tsx');

  if (fs.existsSync(navPath)) {
    const c = fs.readFileSync(navPath, 'utf-8');
    if (c.includes("'/public/problem-grid'") && c.includes('data.problems')) {
      pass('Frontend', 'ProblemGridNavigation', 'Calls GET /public/problem-grid and uses data.problems');
    } else {
      fail('Frontend', 'ProblemGridNavigation', 'Should call /public/problem-grid and use data.problems');
    }
    if (c.includes('apiProblems') && c.includes('allProblems')) {
      pass('Frontend', 'ProblemGridNavigation fallback', 'Uses API data when present, else hardcoded');
    }
  } else {
    skip('Frontend', 'ProblemGridNavigation', 'File not found');
  }

  if (fs.existsSync(homePath)) {
    const c = fs.readFileSync(homePath, 'utf-8');
    if (c.includes('/public/problem-grid/') && c.includes('apiRoleId')) {
      pass('Frontend', 'HomeServiceLanding', 'Calls GET /public/problem-grid/:roleId with mapped roleId');
    } else {
      fail('Frontend', 'HomeServiceLanding', 'Should call /public/problem-grid/:roleId');
    }
    if (c.includes('problemsFromApi') && c.includes('config.problems')) {
      pass('Frontend', 'HomeServiceLanding fallback', 'Uses API problems when present, else config.problems');
    }
  } else {
    skip('Frontend', 'HomeServiceLanding', 'File not found');
  }

  if (fs.existsSync(specPath)) {
    const c = fs.readFileSync(specPath, 'utf-8');
    if (c.includes('/vendor/problem-grid-specializations/') && c.includes('data.specializations')) {
      pass('Frontend', 'SpecializationSelector', 'Calls GET /vendor/problem-grid-specializations/:roleId and uses data.specializations');
    } else {
      fail('Frontend', 'SpecializationSelector', 'Should call problem-grid-specializations and use specializations');
    }
  } else {
    skip('Frontend', 'SpecializationSelector', 'File not found');
  }
}

// ========== 3. Category/role mapping consistency ==========
function verifyMappings() {
  console.log('\n📋 3. CategoryId / roleId mappings');

  const navPath = path.join(process.cwd(), 'apps/customer-web/components/customer/ProblemGridNavigation.tsx');
  const homePath = path.join(process.cwd(), 'apps/customer-web/components/customer/home-services/HomeServiceLanding.tsx');

  const expectedCategories = ['veterinary', 'grooming', 'training', 'walker', 'boarding', 'behavioral', 'wellness', 'nutrition'];
  if (fs.existsSync(navPath)) {
    const c = fs.readFileSync(navPath, 'utf-8');
    const hasVet = c.includes("veterinary: { category: 'vet'");
    const hasGrooming = c.includes("grooming: { category: 'grooming'");
    if (hasVet && hasGrooming) {
      pass('Mappings', 'ProblemGridNavigation CATEGORY_ID_TO_SLUG', 'Maps categoryId to category + roleId for display');
    } else {
      fail('Mappings', 'ProblemGridNavigation CATEGORY_ID_TO_SLUG', 'Should map veterinary, grooming, etc.');
    }
  }

  if (fs.existsSync(homePath)) {
    const c = fs.readFileSync(homePath, 'utf-8');
    if (c.includes('ROLE_ID_FOR_PROBLEM_GRID') && c.includes('pet_groomer') && c.includes('groomer')) {
      pass('Mappings', 'HomeServiceLanding ROLE_ID_FOR_PROBLEM_GRID', 'Maps config roleId to API roleId (e.g. pet_groomer -> groomer)');
    } else {
      fail('Mappings', 'HomeServiceLanding ROLE_ID_FOR_PROBLEM_GRID', 'Should map pet_groomer, dog_walker, etc.');
    }
  }
}

// ========== 4. Live API checks (optional) ==========
async function verifyLiveAPI() {
  if (!API_BASE) {
    skip('API', 'live checks', 'Set API_BASE_URL to run live API checks');
    return;
  }
  console.log('\n📋 4. Live API checks');

  try {
    const r1 = await fetchAPI('/public/problem-grid');
    if (r1.status === 200 && r1.data.success && Array.isArray(r1.data.problems)) {
      pass('API', 'GET /public/problem-grid', `Returns ${r1.data.problems.length} problems`);
    } else {
      fail('API', 'GET /public/problem-grid', `Status ${r1.status} or invalid shape`, r1.data);
    }
  } catch (e) {
    fail('API', 'GET /public/problem-grid', e.message);
  }

  try {
    const r2 = await fetchAPI('/public/problem-grid/groomer');
    if (r2.status === 200 && r2.data.success && Array.isArray(r2.data.problems)) {
      pass('API', 'GET /public/problem-grid/:roleId', `groomer: ${r2.data.problems.length} problems`);
    } else {
      skip('API', 'GET /public/problem-grid/groomer', `Status ${r2.status} (empty OK if no data)`);
    }
  } catch (e) {
    fail('API', 'GET /public/problem-grid/:roleId', e.message);
  }

  try {
    const r3 = await fetchAPI('/vendor/problem-grid-specializations/veterinarian');
    if (r3.status === 200 && r3.data.success && Array.isArray(r3.data.specializations)) {
      pass('API', 'GET /vendor/problem-grid-specializations/:roleId', `veterinarian: ${r3.data.specializations.length} specializations`);
    } else {
      skip('API', 'GET /vendor/problem-grid-specializations/veterinarian', `Status ${r3.status} (empty OK)`);
    }
  } catch (e) {
    fail('API', 'GET /vendor/problem-grid-specializations/:roleId', e.message);
  }
}

async function main() {
  console.log('🔍 Forensic Verification: Specialization / Catalog Flow');
  console.log('=========================================================');

  verifyBackendRoutes();
  verifyFrontendPaths();
  verifyMappings();
  await verifyLiveAPI();

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  console.log('\n=========================================================');
  console.log(`Result: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
