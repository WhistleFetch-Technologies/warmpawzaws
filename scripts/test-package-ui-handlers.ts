/**
 * ============================================================================
 * PACKAGE MANAGEMENT UI & HANDLER TEST
 * ============================================================================
 * 
 * Tests UI components, handlers, and data flow for package management:
 * 1. Component imports and registration
 * 2. Data mapping and transformation
 * 3. Handler functions
 * 4. Route configuration
 * 5. API contract compliance
 * 
 * Usage:
 *   npx tsx scripts/test-package-ui-handlers.ts
 * 
 * Date: 2026-01-25
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

const results: Array<{ test: string; status: 'PASS' | 'FAIL' | 'SKIP'; message?: string; details?: any }> = [];

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function recordResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message?: string, details?: any) {
  results.push({ test, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  log(`${icon} ${test}: ${status}${message ? ' - ' + message : ''}`, status === 'PASS' ? 'success' : status === 'FAIL' ? 'error' : 'warning');
}

// ============================================================================
// TEST 1: Component File Existence
// ============================================================================
function testComponentFiles() {
  log('\n📁 TEST 1: Component File Existence', 'info');
  
  const components = [
    'apps/vendor-web/components/vendor/AppointmentDetailModal.tsx',
    'backend/lambda/src/endpoints/vendor-bookings.ts',
    'backend/lambda/src/endpoints/package-booking.ts',
    'backend/lambda/src/endpoints/settlements.ts',
  ];

  components.forEach(component => {
    const fullPath = path.join(process.cwd(), component);
    if (fs.existsSync(fullPath)) {
      recordResult(`Component exists: ${component}`, 'PASS');
    } else {
      recordResult(`Component exists: ${component}`, 'FAIL', 'File not found');
    }
  });
}

// ============================================================================
// TEST 2: Package Field Mapping in Frontend
// ============================================================================
function testFrontendPackageMapping() {
  log('\n🔄 TEST 2: Frontend Package Field Mapping', 'info');
  
  const componentPath = path.join(process.cwd(), 'apps/vendor-web/components/vendor/AppointmentDetailModal.tsx');
  
  if (!fs.existsSync(componentPath)) {
    recordResult('Frontend Package Mapping', 'SKIP', 'Component file not found');
    return;
  }

  const content = fs.readFileSync(componentPath, 'utf-8');
  
  // Check for package field mappings
  const checks = [
    { name: 'isPackageSession mapping', pattern: /isPackageSession.*rawBooking\.isPackageSession|rawBooking\.is_package_session/i },
    { name: 'packageName mapping', pattern: /packageName.*rawBooking\.packageName|rawBooking\.package_name/i },
    { name: 'packageSessionNumber mapping', pattern: /packageSessionNumber.*rawBooking\.packageSessionNumber|rawBooking\.package_session_number/i },
    { name: 'packageRemainingSessions mapping', pattern: /packageRemainingSessions.*rawBooking\.packageRemainingSessions|rawBooking\.package_remaining_sessions/i },
    { name: 'Package badge rendering', pattern: /isPackageSession.*Package|Package.*isPackageSession|bg-purple-50.*Package/i },
    { name: 'Package icon import', pattern: /import.*Package.*from.*lucide-react/i },
  ];

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      recordResult(`Frontend: ${check.name}`, 'PASS');
    } else {
      recordResult(`Frontend: ${check.name}`, 'FAIL', 'Pattern not found');
    }
  });
}

// ============================================================================
// TEST 3: Backend Package Info Endpoint
// ============================================================================
function testBackendPackageInfo() {
  log('\n🔌 TEST 3: Backend Package Info Endpoint', 'info');
  
  const endpointPath = path.join(process.cwd(), 'backend/lambda/src/endpoints/vendor-bookings.ts');
  
  if (!fs.existsSync(endpointPath)) {
    recordResult('Backend Package Info', 'SKIP', 'Endpoint file not found');
    return;
  }

  const content = fs.readFileSync(endpointPath, 'utf-8');
  
  // Check for package info fetching
  const checks = [
    { name: 'Package purchase query', pattern: /package_purchases|packagePurchaseId/i },
    { name: 'Package info in response', pattern: /isPackageSession|packageName|packageSessionNumber/i },
    { name: 'Package fields mapping', pattern: /packageName.*package_name|packageRemainingSessions.*remaining_sessions/i },
  ];

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      recordResult(`Backend: ${check.name}`, 'PASS');
    } else {
      recordResult(`Backend: ${check.name}`, 'FAIL', 'Pattern not found');
    }
  });
}

// ============================================================================
// TEST 4: Settlement Exclusion Logic
// ============================================================================
function testSettlementExclusion() {
  log('\n💵 TEST 4: Settlement Exclusion Logic', 'info');
  
  const endpointPath = path.join(process.cwd(), 'backend/lambda/src/endpoints/settlements.ts');
  
  if (!fs.existsSync(endpointPath)) {
    recordResult('Settlement Exclusion', 'SKIP', 'Endpoint file not found');
    return;
  }

  const content = fs.readFileSync(endpointPath, 'utf-8');
  
  // Check for exclusion logic
  const checks = [
    { name: 'Package session exclusion', pattern: /is_package_session.*false|package_purchase_id.*null|AND.*is_package_session.*FALSE/i },
    { name: 'Exclusion in WHERE clause', pattern: /WHERE.*is_package_session|WHERE.*package_purchase_id|AND.*is_package_session|AND.*package_purchase_id/i },
  ];

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      recordResult(`Settlement: ${check.name}`, 'PASS');
    } else {
      recordResult(`Settlement: ${check.name}`, 'FAIL', 'Pattern not found');
    }
  });
}

// ============================================================================
// TEST 5: Tax Calculation in Package Purchase
// ============================================================================
function testTaxCalculation() {
  log('\n💰 TEST 5: Tax Calculation in Package Purchase', 'info');
  
  const endpointPath = path.join(process.cwd(), 'backend/lambda/src/endpoints/package-booking.ts');
  
  if (!fs.existsSync(endpointPath)) {
    recordResult('Tax Calculation', 'SKIP', 'Endpoint file not found');
    return;
  }

  const content = fs.readFileSync(endpointPath, 'utf-8');
  
  // Check for tax calculation
  const checks = [
    { name: 'Tax rate definition', pattern: /taxRate.*18|18.*tax|GST/i },
    { name: 'Tax amount calculation', pattern: /taxAmount.*=|tax_amount.*=/i },
    { name: 'Total with tax', pattern: /totalWithTax|total_with_tax/i },
    { name: 'Tax fields in INSERT', pattern: /INSERT.*tax_rate|INSERT.*tax_amount|INSERT.*total_with_tax|tax_rate.*tax_amount.*total_with_tax/i },
  ];

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      recordResult(`Tax: ${check.name}`, 'PASS');
    } else {
      recordResult(`Tax: ${check.name}`, 'FAIL', 'Pattern not found');
    }
  });
}

// ============================================================================
// TEST 6: API Route Registration
// ============================================================================
function testAPIRoutes() {
  log('\n🛣️  TEST 6: API Route Registration', 'info');
  
  const routes = [
    { file: 'backend/lambda/src/endpoints/vendor-bookings.ts', route: '/vendor/bookings/:bookingId/details' },
    { file: 'backend/lambda/src/endpoints/package-booking.ts', route: '/packages/convert-from-trial' },
    { file: 'backend/lambda/src/endpoints/package-booking.ts', route: '/bookings/create-from-package' },
    { file: 'backend/lambda/src/endpoints/settlements.ts', route: '/settlements/calculate-daily' },
  ];

  routes.forEach(({ file, route }) => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      recordResult(`Route: ${route}`, 'SKIP', 'File not found');
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const routePattern = new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, '\\w+'), 'i');
    
    if (routePattern.test(content) || content.includes(route)) {
      recordResult(`Route: ${route}`, 'PASS');
    } else {
      recordResult(`Route: ${route}`, 'FAIL', 'Route not found in file');
    }
  });
}

// ============================================================================
// TEST 7: Data Type Definitions
// ============================================================================
function testDataTypeDefinitions() {
  log('\n📋 TEST 7: Data Type Definitions', 'info');
  
  const componentPath = path.join(process.cwd(), 'apps/vendor-web/components/vendor/AppointmentDetailModal.tsx');
  
  if (!fs.existsSync(componentPath)) {
    recordResult('Data Types', 'SKIP', 'Component file not found');
    return;
  }

  const content = fs.readFileSync(componentPath, 'utf-8');
  
  // Check for TypeScript interface/type definitions
  const checks = [
    { name: 'Booking interface with package fields', pattern: /interface.*Booking|type.*Booking/i },
    { name: 'isPackageSession field', pattern: /isPackageSession\??\s*:/i },
    { name: 'packageName field', pattern: /packageName\??\s*:/i },
    { name: 'packageSessionNumber field', pattern: /packageSessionNumber\??\s*:/i },
  ];

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      recordResult(`Type: ${check.name}`, 'PASS');
    } else {
      recordResult(`Type: ${check.name}`, 'FAIL', 'Type definition not found');
    }
  });
}

// ============================================================================
// TEST 8: Error Handling
// ============================================================================
function testErrorHandling() {
  log('\n⚠️  TEST 8: Error Handling', 'info');
  
  const componentPath = path.join(process.cwd(), 'apps/vendor-web/components/vendor/AppointmentDetailModal.tsx');
  
  if (!fs.existsSync(componentPath)) {
    recordResult('Error Handling', 'SKIP', 'Component file not found');
    return;
  }

  const content = fs.readFileSync(componentPath, 'utf-8');
  
  // Check for error handling
  const checks = [
    { name: 'Null checks for booking', pattern: /booking\s*&&|booking\?\./i },
    { name: 'Try-catch blocks', pattern: /try\s*\{|catch\s*\(/i },
    { name: 'Optional chaining', pattern: /booking\?\./i },
  ];

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      recordResult(`Error Handling: ${check.name}`, 'PASS');
    } else {
      recordResult(`Error Handling: ${check.name}`, 'FAIL', 'Pattern not found');
    }
  });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
async function runAllTests() {
  log('='.repeat(70), 'info');
  log('🧪 PACKAGE MANAGEMENT UI & HANDLER TEST SUITE', 'info');
  log('='.repeat(70), 'info');
  log('', 'info');

  testComponentFiles();
  testFrontendPackageMapping();
  testBackendPackageInfo();
  testSettlementExclusion();
  testTaxCalculation();
  testAPIRoutes();
  testDataTypeDefinitions();
  testErrorHandling();

  // Summary
  log('\n' + '='.repeat(70), 'info');
  log('📊 TEST RESULTS SUMMARY', 'info');
  log('='.repeat(70), 'info');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  log(`\n✅ Passed: ${passed}`, 'success');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'error' : 'info');
  log(`⏭️  Skipped: ${skipped}`, 'warning');
  log(`📊 Total: ${total}`, 'info');
  log('', 'info');

  if (failed > 0) {
    log('❌ FAILED TESTS:', 'error');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      log(`   - ${r.test}: ${r.message || 'Unknown error'}`, 'error');
    });
    log('', 'info');
  }

  log('='.repeat(70), 'info');
  
  if (failed === 0) {
    log('✅ ALL TESTS PASSED!', 'success');
    return true;
  } else {
    log('❌ SOME TESTS FAILED', 'error');
    return false;
  }
}

// Run tests
runAllTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
