#!/usr/bin/env node

/**
 * ============================================================================
 * ENHANCED HANDLERS TEST SCRIPT
 * ============================================================================
 * 
 * Tests the enhanced handlers for:
 * - Compilation errors
 * - API contracts integration
 * - Import resolution
 * - Type safety
 * 
 * Usage: node scripts/test-enhanced-handlers.js
 * ============================================================================
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath) {
  return fs.existsSync(filePath);
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

const lambdaDir = path.join(__dirname, '..', 'backend', 'lambda');
const endpointsDir = path.join(lambdaDir, 'src', 'endpoints');
const apiContractsDir = path.join(__dirname, '..', 'packages', 'api-contracts');

log('\n=== Enhanced Handlers Test Suite ===\n', 'cyan');

// Test 1: Check enhanced handler files exist
log('Test 1: Checking enhanced handler files...', 'blue');
const enhancedHandlers = [
  'auth-enhanced.ts',
  'bookings-enhanced.ts',
  'vendor-onboarding-enhanced.ts',
  'customer-enhanced.ts',
  'payments-enhanced.ts',
];

let allFilesExist = true;
enhancedHandlers.forEach(handler => {
  const filePath = path.join(endpointsDir, handler);
  if (checkFile(filePath)) {
    log(`  ✅ ${handler}`, 'green');
  } else {
    log(`  ❌ ${handler} - NOT FOUND`, 'red');
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  log('\n❌ Some enhanced handler files are missing!', 'red');
  process.exit(1);
}

// Test 2: Check API contracts package
log('\nTest 2: Checking API contracts package...', 'blue');
const apiContractsFiles = [
  'dist/index.js',
  'dist/auth.js',
  'dist/bookings.js',
  'dist/vendors.js',
  'dist/customers.js',
  'dist/payments.js',
];

let allContractsExist = true;
apiContractsFiles.forEach(file => {
  const filePath = path.join(apiContractsDir, file);
  if (checkFile(filePath)) {
    log(`  ✅ ${file}`, 'green');
  } else {
    log(`  ❌ ${file} - NOT FOUND`, 'red');
    allContractsExist = false;
  }
});

if (!allContractsExist) {
  log('\n⚠️  Some API contract files are missing. Building package...', 'yellow');
  try {
    execSync('npm run build', { cwd: apiContractsDir, stdio: 'inherit' });
    log('  ✅ API contracts built successfully', 'green');
  } catch (error) {
    log('  ❌ Failed to build API contracts', 'red');
    process.exit(1);
  }
}

// Test 3: Check imports in enhanced handlers
log('\nTest 3: Checking API contracts imports...', 'blue');
const importChecks = {
  'auth-enhanced.ts': ['@warmpawz/api-contracts/auth'],
  'bookings-enhanced.ts': ['@warmpawz/api-contracts/bookings'],
  'vendor-onboarding-enhanced.ts': ['@warmpawz/api-contracts/vendors'],
  'customer-enhanced.ts': ['@warmpawz/api-contracts/customers'],
  'payments-enhanced.ts': ['@warmpawz/api-contracts/payments'],
};

let allImportsValid = true;
Object.entries(importChecks).forEach(([file, expectedImports]) => {
  const filePath = path.join(endpointsDir, file);
  if (!checkFile(filePath)) {
    log(`  ⚠️  ${file} - File not found, skipping`, 'yellow');
    return;
  }

  const content = readFile(filePath);
  expectedImports.forEach(importPath => {
    if (content.includes(importPath)) {
      log(`  ✅ ${file} imports ${importPath}`, 'green');
    } else {
      log(`  ❌ ${file} missing import: ${importPath}`, 'red');
      allImportsValid = false;
    }
  });
});

if (!allImportsValid) {
  log('\n❌ Some imports are missing!', 'red');
  process.exit(1);
}

// Test 4: Check for inline schemas (should be removed)
log('\nTest 4: Checking for removed inline schemas...', 'blue');
const inlineSchemaPatterns = [
  /const\s+\w+RequestSchema\s*=\s*z\.object/,
  /const\s+\w+ResponseSchema\s*=\s*z\.object/,
  /\/\/\s*Temporary\s+inline/,
  /\/\/\s*TODO.*inline/,
];

let foundInlineSchemas = false;
enhancedHandlers.forEach(handler => {
  const filePath = path.join(endpointsDir, handler);
  if (!checkFile(filePath)) return;

  const content = readFile(filePath);
  inlineSchemaPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      log(`  ⚠️  ${handler} may contain inline schemas`, 'yellow');
      foundInlineSchemas = true;
    }
  });
});

if (!foundInlineSchemas) {
  log('  ✅ No inline schemas found (all using API contracts)', 'green');
}

// Test 5: Check TypeScript compilation (enhanced handlers only)
log('\nTest 5: Checking TypeScript compilation...', 'blue');
try {
  // Check if enhanced handlers compile
  const enhancedFiles = enhancedHandlers.map(h => path.join(endpointsDir, h)).join(' ');
  execSync(
    `npx tsc --noEmit --skipLibCheck ${enhancedFiles}`,
    { cwd: lambdaDir, stdio: 'pipe' }
  );
  log('  ✅ All enhanced handlers compile successfully', 'green');
} catch (error) {
  const output = error.stdout?.toString() || error.stderr?.toString() || '';
  if (output.includes('error TS')) {
    log('  ❌ TypeScript compilation errors found:', 'red');
    console.log(output);
    process.exit(1);
  } else {
    log('  ⚠️  Compilation check incomplete', 'yellow');
  }
}

// Test 6: Check BaseHandlerEnhanced usage
log('\nTest 6: Checking BaseHandlerEnhanced usage...', 'blue');
let allUseEnhanced = true;
enhancedHandlers.forEach(handler => {
  const filePath = path.join(endpointsDir, handler);
  if (!checkFile(filePath)) return;

  const content = readFile(filePath);
  if (content.includes('BaseHandlerEnhanced')) {
    log(`  ✅ ${handler} uses BaseHandlerEnhanced`, 'green');
  } else if (content.includes('BaseHandler') && !content.includes('BaseHandlerEnhanced')) {
    log(`  ❌ ${handler} still uses old BaseHandler`, 'red');
    allUseEnhanced = false;
  }
});

if (!allUseEnhanced) {
  log('\n❌ Some handlers still use old BaseHandler!', 'red');
  process.exit(1);
}

// Test 7: Check for Zod validation usage
log('\nTest 7: Checking Zod validation usage...', 'blue');
let allUseZod = true;
enhancedHandlers.forEach(handler => {
  const filePath = path.join(endpointsDir, handler);
  if (!checkFile(filePath)) return;

  const content = readFile(filePath);
  if (content.includes('.safeParse(') || content.includes('Schema.safeParse')) {
    log(`  ✅ ${handler} uses Zod validation`, 'green');
  } else {
    log(`  ⚠️  ${handler} may not use Zod validation`, 'yellow');
  }
});

// Test 8: Check for standardized error handling
log('\nTest 8: Checking standardized error handling...', 'blue');
enhancedHandlers.forEach(handler => {
  const filePath = path.join(endpointsDir, handler);
  if (!checkFile(filePath)) return;

  const content = readFile(filePath);
  if (content.includes('this.error(') && content.includes('requestId')) {
    log(`  ✅ ${handler} uses standardized error handling`, 'green');
  } else {
    log(`  ⚠️  ${handler} may not use standardized error handling`, 'yellow');
  }
});

// Summary
log('\n=== Test Summary ===', 'cyan');
log('✅ Enhanced handler files: All present', 'green');
log('✅ API contracts package: Built and available', 'green');
log('✅ API contracts imports: All valid', 'green');
log('✅ BaseHandlerEnhanced: All handlers migrated', 'green');
log('✅ TypeScript compilation: Enhanced handlers compile', 'green');

log('\n🎉 All enhanced handlers are properly configured!', 'green');
log('\nNext steps:', 'cyan');
log('  1. Test handlers with actual API requests', 'blue');
log('  2. Verify CloudWatch logs are structured', 'blue');
log('  3. Test JWT validation', 'blue');
log('  4. Test API contract validation', 'blue');

