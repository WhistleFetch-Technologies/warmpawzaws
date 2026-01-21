#!/usr/bin/env npx ts-node
/**
 * WARMPAWZ PRODUCTION READINESS AUDIT SCRIPT
 * 
 * This script performs automated verification of:
 * 1. API Contract Matching (Frontend → Backend)
 * 2. Database Schema Completeness
 * 3. UI Component Coverage
 * 4. Service Flow Completeness
 * 5. Payment Integration
 * 
 * Run: npx ts-node scripts/production-readiness-audit.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Simple glob replacement using fs
function findFilesRecursive(dir: string, pattern: RegExp, results: string[] = []): string[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.includes('dist') && !entry.name.startsWith('.')) {
        findFilesRecursive(fullPath, pattern, results);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch (e) {
    // Ignore permission errors
  }
  return results;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  projectRoot: path.resolve(__dirname, '..'),
  customerWebPath: 'apps/customer-web',
  vendorWebPath: 'apps/vendor-web',
  adminWebPath: 'apps/admin-web',
  customerMobilePath: 'apps/WarmpawzCustomer',
  vendorMobilePath: 'apps/WarmpawzVendor',
  backendPath: 'backend/lambda/src',
  migrationsPath: 'db/migrations',
  serviceCatalogPath: 'COMPLETE_SERVICE_CATALOG.json',
};

// ============================================================================
// TYPES
// ============================================================================

interface Service {
  service_id: string;
  service_name: string;
  category_id: string;
  category_name: string;
  applicable_roles: string[];
  service_style: string;
  base_price: number;
  is_package: boolean;
}

interface AuditResult {
  category: string;
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  file?: string;
}

interface APIEndpoint {
  method: string;
  path: string;
  file: string;
  line: number;
}

// ============================================================================
// UTILITIES
// ============================================================================

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(path.join(CONFIG.projectRoot, filePath), 'utf-8');
  } catch {
    return '';
  }
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(path.join(CONFIG.projectRoot, filePath));
}

function findFiles(pattern: string): string[] {
  // Extract directory and file pattern from the glob-like pattern
  const parts = pattern.split('/');
  const filePattern = parts.pop() || '';
  const dir = parts.join('/');
  
  // Convert glob pattern to regex
  const regexPattern = filePattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\{([^}]+)\}/g, (_, group) => `(${group.replace(/,/g, '|')})`);
  
  const regex = new RegExp(regexPattern + '$');
  const fullDir = path.join(CONFIG.projectRoot, dir);
  
  if (!fs.existsSync(fullDir)) {
    return [];
  }
  
  const results = findFilesRecursive(fullDir, regex);
  // Return relative paths
  return results.map(r => path.relative(CONFIG.projectRoot, r));
}

// ============================================================================
// AUDIT 1: SERVICE CATALOG VERIFICATION
// ============================================================================

function auditServiceCatalog(): AuditResult[] {
  const results: AuditResult[] = [];
  
  console.log('\n📋 AUDIT 1: SERVICE CATALOG VERIFICATION');
  console.log('=========================================\n');
  
  const catalogPath = CONFIG.serviceCatalogPath;
  if (!fileExists(catalogPath)) {
    results.push({
      category: 'Service Catalog',
      check: 'Catalog file exists',
      status: 'FAIL',
      details: 'COMPLETE_SERVICE_CATALOG.json not found',
    });
    return results;
  }
  
  const catalog = JSON.parse(readFile(catalogPath));
  const services: Service[] = catalog.services || [];
  const packages: Service[] = catalog.packages || [];
  
  console.log(`✅ Found ${services.length} services`);
  console.log(`✅ Found ${packages.length} packages`);
  
  results.push({
    category: 'Service Catalog',
    check: 'Service count',
    status: services.length >= 70 ? 'PASS' : 'FAIL',
    details: `${services.length} services found (expected 77+)`,
  });
  
  // Verify all categories are present
  const categories = [...new Set(services.map(s => s.category_id))];
  const expectedCategories = [
    'veterinary', 'diagnostic', 'grooming', 'training', 'walking',
    'boarding', 'emergency', 'pharmacy', 'wellness', 'specialty'
  ];
  
  for (const cat of expectedCategories) {
    const exists = categories.includes(cat);
    results.push({
      category: 'Service Catalog',
      check: `Category: ${cat}`,
      status: exists ? 'PASS' : 'FAIL',
      details: exists ? `Category ${cat} found` : `Category ${cat} MISSING`,
    });
    console.log(exists ? `  ✅ ${cat}` : `  ❌ ${cat} MISSING`);
  }
  
  return results;
}

// ============================================================================
// AUDIT 2: BACKEND ENDPOINT VERIFICATION
// ============================================================================

function auditBackendEndpoints(): AuditResult[] {
  const results: AuditResult[] = [];
  
  console.log('\n📋 AUDIT 2: BACKEND ENDPOINT VERIFICATION');
  console.log('==========================================\n');
  
  const endpointFiles = findFiles(`${CONFIG.backendPath}/endpoints/*.ts`);
  console.log(`Found ${endpointFiles.length} endpoint files`);
  
  const endpoints: APIEndpoint[] = [];
  
  // Required endpoints for complete booking flow
  const requiredEndpoints = [
    { method: 'POST', path: '/booking/create' },
    { method: 'GET', path: '/booking/:id' },
    { method: 'PUT', path: '/booking/:id/status' },
    { method: 'POST', path: '/booking/:id/payment' },
    { method: 'GET', path: '/customer/pets' },
    { method: 'POST', path: '/customer/pets' },
    { method: 'GET', path: '/customer/:phone/addresses' },
    { method: 'POST', path: '/customer/:phone/addresses' },
    { method: 'GET', path: '/vendor/:id/services' },
    { method: 'GET', path: '/vendor/:id/schedule' },
    { method: 'GET', path: '/customer/discover-services' },
    { method: 'POST', path: '/payments/create-order' },
    { method: 'POST', path: '/payments/verify' },
    { method: 'GET', path: '/packages/check-for-booking' },
    { method: 'POST', path: '/packages/purchase' },
    { method: 'POST', path: '/reviews/create' },
    { method: 'GET', path: '/reviews/:vendorId' },
  ];
  
  for (const file of endpointFiles) {
    const content = readFile(file);
    const routeMatches = content.matchAll(/router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
    
    for (const match of routeMatches) {
      endpoints.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: file,
        line: content.substring(0, match.index).split('\n').length,
      });
    }
  }
  
  console.log(`\nTotal endpoints found: ${endpoints.length}\n`);
  
  for (const required of requiredEndpoints) {
    const found = endpoints.some(e => 
      e.method === required.method && 
      (e.path === required.path || e.path.includes(required.path.replace(':id', '').replace(':phone', '')))
    );
    
    results.push({
      category: 'Backend Endpoints',
      check: `${required.method} ${required.path}`,
      status: found ? 'PASS' : 'FAIL',
      details: found ? 'Endpoint exists' : 'Endpoint MISSING',
    });
    
    console.log(found ? `  ✅ ${required.method} ${required.path}` : `  ❌ ${required.method} ${required.path} MISSING`);
  }
  
  results.push({
    category: 'Backend Endpoints',
    check: 'Total endpoint count',
    status: endpoints.length >= 100 ? 'PASS' : 'WARN',
    details: `${endpoints.length} endpoints found`,
  });
  
  return results;
}

// ============================================================================
// AUDIT 3: BOOKING ROUTER VERIFICATION
// ============================================================================

function auditBookingRouters(): AuditResult[] {
  const results: AuditResult[] = [];
  
  console.log('\n📋 AUDIT 3: BOOKING ROUTER VERIFICATION');
  console.log('========================================\n');
  
  const customerComponents = findFiles(`${CONFIG.customerWebPath}/components/**/*.tsx`);
  
  // Expected dedicated booking routers
  const expectedRouters = [
    { name: 'VetBookingRouter', pattern: /VetBookingRouter|VetServiceRouter/i },
    { name: 'GroomingBookingRouter', pattern: /GroomingBookingRouter|GroomingServiceRouter/i },
    { name: 'TrainingBookingRouter', pattern: /TrainingBookingRouter|TrainingServiceRouter/i },
    { name: 'WalkerBookingRouter', pattern: /WalkerBookingRouter|WalkerService/i },
    { name: 'BoardingBookingRouter', pattern: /BoardingBookingRouter|BoardingServiceRouter/i },
    { name: 'PharmacyOrderFlow', pattern: /PharmacyOrder|PrescriptionOrder/i },
    { name: 'ResortBookingRouter', pattern: /ResortBooking|ResortService/i },
    { name: 'CafeReservationFlow', pattern: /CafeReservation/i },
    { name: 'PhotographyBookingRouter', pattern: /PhotographyService|PhotographyBooking/i },
    { name: 'TransportBookingRouter', pattern: /TransportService|RelocationService/i },
  ];
  
  for (const router of expectedRouters) {
    const found = customerComponents.some(f => router.pattern.test(f));
    let hasCompleteFlow = false;
    
    if (found) {
      // Check if the router has complete flow (service selection, payment, confirmation)
      const matchingFiles = customerComponents.filter(f => router.pattern.test(f));
      for (const file of matchingFiles) {
        const content = readFile(file);
        const hasServiceSelection = /service.*select|selectedService|services\s*\[/i.test(content);
        const hasPayment = /razorpay|payment|handlePay/i.test(content);
        const hasConfirmation = /confirmation|success|complete/i.test(content);
        
        if (hasServiceSelection && hasPayment && hasConfirmation) {
          hasCompleteFlow = true;
        }
      }
    }
    
    results.push({
      category: 'Booking Routers',
      check: router.name,
      status: hasCompleteFlow ? 'PASS' : found ? 'WARN' : 'FAIL',
      details: hasCompleteFlow 
        ? 'Complete flow with payment' 
        : found 
          ? 'Router exists but may be incomplete'
          : 'Router MISSING',
    });
    
    console.log(
      hasCompleteFlow 
        ? `  ✅ ${router.name} - Complete`
        : found 
          ? `  ⚠️  ${router.name} - Exists but verify flow`
          : `  ❌ ${router.name} - MISSING`
    );
  }
  
  return results;
}

// ============================================================================
// AUDIT 4: PAYMENT INTEGRATION VERIFICATION
// ============================================================================

function auditPaymentIntegration(): AuditResult[] {
  const results: AuditResult[] = [];
  
  console.log('\n📋 AUDIT 4: PAYMENT INTEGRATION VERIFICATION');
  console.log('=============================================\n');
  
  // Check backend payment handlers
  const paymentFiles = findFiles(`${CONFIG.backendPath}/endpoints/payment*.ts`);
  const razorpayFiles = findFiles(`${CONFIG.backendPath}/endpoints/razorpay*.ts`);
  
  console.log(`Payment endpoint files: ${paymentFiles.length}`);
  console.log(`Razorpay endpoint files: ${razorpayFiles.length}`);
  
  // Check for Razorpay SDK usage in backend
  let razorpayBackendIntegration = false;
  for (const file of [...paymentFiles, ...razorpayFiles]) {
    const content = readFile(file);
    if (/Razorpay|razorpay.*orders.*create|razorpay.*payments.*capture/i.test(content)) {
      razorpayBackendIntegration = true;
      break;
    }
  }
  
  results.push({
    category: 'Payment Integration',
    check: 'Razorpay backend integration',
    status: razorpayBackendIntegration ? 'PASS' : 'FAIL',
    details: razorpayBackendIntegration ? 'Razorpay SDK found in backend' : 'Razorpay integration MISSING',
  });
  
  console.log(razorpayBackendIntegration 
    ? '  ✅ Razorpay backend integration found'
    : '  ❌ Razorpay backend integration MISSING'
  );
  
  // Check frontend payment components
  const customerPaymentComponents = findFiles(`${CONFIG.customerWebPath}/components/**/payment/**/*.tsx`);
  const customerPaymentInline = findFiles(`${CONFIG.customerWebPath}/components/**/*Payment*.tsx`);
  
  console.log(`\nPayment components: ${customerPaymentComponents.length + customerPaymentInline.length}`);
  
  // Check for Razorpay checkout in frontend
  const allCustomerFiles = findFiles(`${CONFIG.customerWebPath}/**/*.tsx`);
  let razorpayFrontendIntegration = false;
  
  for (const file of allCustomerFiles) {
    const content = readFile(file);
    if (/useRazorpay|Razorpay|razorpay\.open|razorpay_order_id/i.test(content)) {
      razorpayFrontendIntegration = true;
      break;
    }
  }
  
  results.push({
    category: 'Payment Integration',
    check: 'Razorpay frontend integration',
    status: razorpayFrontendIntegration ? 'PASS' : 'FAIL',
    details: razorpayFrontendIntegration ? 'Razorpay checkout found in frontend' : 'Razorpay checkout MISSING',
  });
  
  console.log(razorpayFrontendIntegration 
    ? '  ✅ Razorpay frontend integration found'
    : '  ❌ Razorpay frontend integration MISSING'
  );
  
  // Check payment verification webhook
  const webhookFiles = findFiles(`${CONFIG.backendPath}/endpoints/webhooks*.ts`);
  let paymentWebhook = false;
  
  for (const file of webhookFiles) {
    const content = readFile(file);
    if (/payment.*webhook|razorpay.*webhook|payment\.captured/i.test(content)) {
      paymentWebhook = true;
      break;
    }
  }
  
  results.push({
    category: 'Payment Integration',
    check: 'Payment webhook handler',
    status: paymentWebhook ? 'PASS' : 'WARN',
    details: paymentWebhook ? 'Payment webhook found' : 'Payment webhook not found',
  });
  
  console.log(paymentWebhook 
    ? '  ✅ Payment webhook handler found'
    : '  ⚠️  Payment webhook handler not found'
  );
  
  return results;
}

// ============================================================================
// AUDIT 5: DATABASE MIGRATION VERIFICATION
// ============================================================================

function auditDatabaseMigrations(): AuditResult[] {
  const results: AuditResult[] = [];
  
  console.log('\n📋 AUDIT 5: DATABASE MIGRATION VERIFICATION');
  console.log('============================================\n');
  
  const migrationFiles = findFiles(`${CONFIG.migrationsPath}/*.sql`);
  console.log(`Total migration files: ${migrationFiles.length}`);
  
  // Required tables
  const requiredTables = [
    'customers', 'vendors', 'pets', 'bookings', 'payments', 'reviews',
    'service_catalog', 'vendor_services', 'customer_addresses',
    'package_purchases', 'package_sessions', 'prescriptions', 'medical_records',
    'orders', 'order_items', 'pharmacy_orders', 'deliveries', 'transactions',
    'settlements', 'wallet_transactions', 'refunds', 'vendor_schedules',
    'roles', 'role_permissions', 'time_slots', 'notifications', 'device_tokens'
  ];
  
  // Read all migrations to check for CREATE TABLE statements
  const allMigrationContent = migrationFiles.map(f => readFile(f)).join('\n');
  
  let tablesFound = 0;
  let tablesMissing: string[] = [];
  
  for (const table of requiredTables) {
    const pattern = new RegExp(`CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?["']?${table}["']?`, 'i');
    const found = pattern.test(allMigrationContent);
    
    if (found) {
      tablesFound++;
    } else {
      tablesMissing.push(table);
    }
  }
  
  console.log(`\nTables found: ${tablesFound}/${requiredTables.length}`);
  
  if (tablesMissing.length > 0) {
    console.log(`\nMissing tables:`);
    tablesMissing.forEach(t => console.log(`  ❌ ${t}`));
  }
  
  results.push({
    category: 'Database',
    check: 'Required tables',
    status: tablesMissing.length === 0 ? 'PASS' : tablesMissing.length < 5 ? 'WARN' : 'FAIL',
    details: `${tablesFound}/${requiredTables.length} tables found. Missing: ${tablesMissing.join(', ')}`,
  });
  
  // Check for key columns in bookings table
  const bookingsPattern = /CREATE\s+TABLE.*bookings[^;]+;/is;
  const bookingsMatch = allMigrationContent.match(bookingsPattern);
  
  if (bookingsMatch) {
    const bookingsSchema = bookingsMatch[0];
    const requiredColumns = ['id', 'customer_id', 'vendor_id', 'service_id', 'status', 'payment_status', 'total_amount'];
    const columnsMissing = requiredColumns.filter(col => !new RegExp(col, 'i').test(bookingsSchema));
    
    results.push({
      category: 'Database',
      check: 'Bookings table columns',
      status: columnsMissing.length === 0 ? 'PASS' : 'WARN',
      details: columnsMissing.length === 0 
        ? 'All required columns found' 
        : `Missing columns: ${columnsMissing.join(', ')}`,
    });
  }
  
  return results;
}

// ============================================================================
// AUDIT 6: VENDOR ROLE & CAPABILITY VERIFICATION
// ============================================================================

function auditVendorRoles(): AuditResult[] {
  const results: AuditResult[] = [];
  
  console.log('\n📋 AUDIT 6: VENDOR ROLE & CAPABILITY VERIFICATION');
  console.log('==================================================\n');
  
  // Check for role seeding migration
  const migrationFiles = findFiles(`${CONFIG.migrationsPath}/*.sql`);
  const roleMigrations = migrationFiles.filter(f => /role|capability/i.test(f));
  
  console.log(`Role-related migrations: ${roleMigrations.length}`);
  
  // Expected vendor roles
  const expectedRoles = [
    'veterinarian', 'vet_clinic', 'diagnostics_center', 'pet_groomer', 'pet_spa',
    'pet_trainer', 'pet_walker', 'pet_boarder', 'pet_daycare', 'pet_sitter',
    'pet_resort', 'ambulance', 'pet_transport', 'pet_relocation', 'pharmacy',
    'pet_nutritionist', 'pet_photographer', 'pet_cafe', 'pet_adoption_center',
    'pet_event_organizer', 'pet_insurance', 'pet_breeder', 'pet_sunset_services',
    'pet_legal_advisor'
  ];
  
  // Read all role-related migrations
  const roleContent = roleMigrations.map(f => readFile(f)).join('\n');
  
  let rolesFound = 0;
  let rolesMissing: string[] = [];
  
  for (const role of expectedRoles) {
    const pattern = new RegExp(`['"]${role}['"]`, 'i');
    if (pattern.test(roleContent)) {
      rolesFound++;
    } else {
      rolesMissing.push(role);
    }
  }
  
  console.log(`Roles found in migrations: ${rolesFound}/${expectedRoles.length}`);
  
  if (rolesMissing.length > 0 && rolesMissing.length < 10) {
    console.log(`\nRoles not found in migrations (may be seeded elsewhere):`);
    rolesMissing.forEach(r => console.log(`  ⚠️  ${r}`));
  }
  
  results.push({
    category: 'Vendor Roles',
    check: 'Role definitions',
    status: rolesFound >= 15 ? 'PASS' : rolesFound >= 10 ? 'WARN' : 'FAIL',
    details: `${rolesFound}/${expectedRoles.length} roles found in migrations`,
  });
  
  // Check for capability enforcement in backend
  const backendFiles = findFiles(`${CONFIG.backendPath}/**/*.ts`);
  let capabilityEnforcement = false;
  
  for (const file of backendFiles) {
    const content = readFile(file);
    if (/capabilityGuard|checkCapability|requireCapability|capability.*enforcement/i.test(content)) {
      capabilityEnforcement = true;
      break;
    }
  }
  
  results.push({
    category: 'Vendor Roles',
    check: 'Capability enforcement',
    status: capabilityEnforcement ? 'PASS' : 'FAIL',
    details: capabilityEnforcement ? 'Capability enforcement found' : 'Capability enforcement MISSING',
  });
  
  console.log(capabilityEnforcement 
    ? '  ✅ Capability enforcement found'
    : '  ❌ Capability enforcement MISSING'
  );
  
  return results;
}

// ============================================================================
// AUDIT 7: FRONTEND-BACKEND API MATCHING
// ============================================================================

function auditAPIMatching(): AuditResult[] {
  const results: AuditResult[] = [];
  
  console.log('\n📋 AUDIT 7: FRONTEND-BACKEND API MATCHING');
  console.log('==========================================\n');
  
  // Extract API calls from frontend
  const frontendFiles = findFiles(`${CONFIG.customerWebPath}/**/*.{ts,tsx}`);
  const apiCalls: Set<string> = new Set();
  
  for (const file of frontendFiles) {
    const content = readFile(file);
    
    // Match fetch/axios calls
    const fetchMatches = content.matchAll(/fetch\s*\(\s*[`'"](\/[^`'"]+)[`'"]/g);
    const axiosMatches = content.matchAll(/axios\.(get|post|put|patch|delete)\s*\(\s*[`'"](\/[^`'"]+)[`'"]/gi);
    const apiMatches = content.matchAll(/api\.(get|post|put|patch|delete)\s*\(\s*[`'"](\/[^`'"]+)[`'"]/gi);
    
    for (const match of fetchMatches) apiCalls.add(match[1]);
    for (const match of axiosMatches) apiCalls.add(match[2]);
    for (const match of apiMatches) apiCalls.add(match[2]);
  }
  
  console.log(`Unique API paths found in frontend: ${apiCalls.size}`);
  
  // Extract routes from backend
  const backendEndpointFiles = findFiles(`${CONFIG.backendPath}/endpoints/*.ts`);
  const backendRoutes: Set<string> = new Set();
  
  for (const file of backendEndpointFiles) {
    const content = readFile(file);
    const routeMatches = content.matchAll(/router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
    
    for (const match of routeMatches) {
      backendRoutes.add(match[2]);
    }
  }
  
  console.log(`Unique routes found in backend: ${backendRoutes.size}`);
  
  // Normalize paths for comparison
  const normalizePath = (p: string) => p.replace(/:[a-zA-Z_]+/g, ':param').replace(/\$\{[^}]+\}/g, ':param');
  
  const normalizedBackend = new Set([...backendRoutes].map(normalizePath));
  const normalizedFrontend = new Set([...apiCalls].map(normalizePath));
  
  // Find frontend calls without backend handlers
  const missingHandlers: string[] = [];
  for (const call of normalizedFrontend) {
    if (!normalizedBackend.has(call)) {
      missingHandlers.push(call);
    }
  }
  
  if (missingHandlers.length > 0 && missingHandlers.length < 20) {
    console.log(`\nFrontend calls without backend handlers:`);
    missingHandlers.slice(0, 10).forEach(m => console.log(`  ⚠️  ${m}`));
    if (missingHandlers.length > 10) {
      console.log(`  ... and ${missingHandlers.length - 10} more`);
    }
  }
  
  const matchPercentage = Math.round((1 - missingHandlers.length / normalizedFrontend.size) * 100);
  
  results.push({
    category: 'API Matching',
    check: 'Frontend-Backend alignment',
    status: matchPercentage >= 90 ? 'PASS' : matchPercentage >= 70 ? 'WARN' : 'FAIL',
    details: `${matchPercentage}% of frontend API calls have backend handlers`,
  });
  
  console.log(`\nAPI matching: ${matchPercentage}%`);
  
  return results;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runAudit() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     WARMPAWZ PRODUCTION READINESS AUDIT                      ║');
  console.log('║     Comprehensive Platform Verification                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const allResults: AuditResult[] = [];
  
  // Run all audits
  allResults.push(...auditServiceCatalog());
  allResults.push(...auditBackendEndpoints());
  allResults.push(...auditBookingRouters());
  allResults.push(...auditPaymentIntegration());
  allResults.push(...auditDatabaseMigrations());
  allResults.push(...auditVendorRoles());
  allResults.push(...auditAPIMatching());
  
  // Generate summary
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT SUMMARY                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const passed = allResults.filter(r => r.status === 'PASS').length;
  const warned = allResults.filter(r => r.status === 'WARN').length;
  const failed = allResults.filter(r => r.status === 'FAIL').length;
  const total = allResults.length;
  
  console.log(`  ✅ PASSED:  ${passed}/${total} (${Math.round(passed/total*100)}%)`);
  console.log(`  ⚠️  WARNINGS: ${warned}/${total} (${Math.round(warned/total*100)}%)`);
  console.log(`  ❌ FAILED:  ${failed}/${total} (${Math.round(failed/total*100)}%)`);
  
  const overallScore = Math.round((passed + warned * 0.5) / total * 100);
  console.log(`\n  📊 OVERALL PRODUCTION READINESS SCORE: ${overallScore}%`);
  
  if (overallScore >= 90) {
    console.log('\n  🎉 STATUS: PRODUCTION READY');
  } else if (overallScore >= 70) {
    console.log('\n  ⚠️  STATUS: NEEDS ATTENTION');
  } else {
    console.log('\n  ❌ STATUS: NOT PRODUCTION READY');
  }
  
  // Write detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      passed,
      warned,
      failed,
      total,
      overallScore,
    },
    results: allResults,
  };
  
  const reportPath = path.join(CONFIG.projectRoot, 'PRODUCTION_READINESS_AUDIT_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  📄 Detailed report saved to: PRODUCTION_READINESS_AUDIT_RESULTS.json`);
  
  // Print failures
  if (failed > 0) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    FAILURES TO FIX                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    allResults
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`  ❌ [${r.category}] ${r.check}`);
        console.log(`     ${r.details}`);
        console.log('');
      });
  }
  
  console.log('\n');
}

// Run the audit
runAudit().catch(console.error);
