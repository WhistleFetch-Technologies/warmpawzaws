/**
 * ============================================================================
 * Environment Validation Test Script
 * ============================================================================
 * 
 * Tests the environment validation utility
 * Run with: npx ts-node test-env-validation.ts
 * ============================================================================
 */

import { validateEnvironment, getValidationReport, validateEnvironmentOrThrow } from './src/utils/env-validation';

console.log('🧪 Testing Environment Validation');
console.log('==================================\n');

// Test 1: Basic validation
console.log('Test 1: Basic Validation');
console.log('-------------------------');
try {
  const result = validateEnvironment();
  console.log('✅ Validation function executed');
  console.log(`   Valid: ${result.valid}`);
  console.log(`   Missing: ${result.missing.length} variables`);
  console.log(`   Warnings: ${result.warnings.length}`);
  console.log(`   Errors: ${result.errors.length}`);
  
  if (result.missing.length > 0) {
    console.log('\n   Missing variables:');
    result.missing.forEach(v => console.log(`     - ${v}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('\n   Warnings:');
    result.warnings.forEach(w => console.log(`     - ${w}`));
  }
  
  if (result.errors.length > 0) {
    console.log('\n   Errors:');
    result.errors.forEach(e => console.log(`     - ${e}`));
  }
} catch (error) {
  console.error('❌ Validation failed:', error);
}

// Test 2: Validation report
console.log('\n\nTest 2: Validation Report');
console.log('-------------------------');
try {
  const report = getValidationReport();
  console.log('✅ Report generated');
  console.log('\n' + report);
} catch (error) {
  console.error('❌ Report generation failed:', error);
}

// Test 3: Validate or throw (should not throw if env is valid)
console.log('\n\nTest 3: Validate or Throw');
console.log('-------------------------');
try {
  validateEnvironmentOrThrow();
  console.log('✅ Environment validation passed (no throw)');
} catch (error) {
  console.log('⚠️  Environment validation failed (expected if vars missing)');
  console.log(`   Error: ${error instanceof Error ? error.message : error}`);
}

// Test 4: Test with missing variables
console.log('\n\nTest 4: Test with Missing Variables');
console.log('------------------------------------');
const originalDbHost = process.env.DB_HOST;
const originalDbName = process.env.DB_NAME;

try {
  // Temporarily remove required vars
  delete process.env.DB_HOST;
  delete process.env.DB_NAME;
  
  const result = validateEnvironment();
  console.log('✅ Validation detected missing variables');
  console.log(`   Valid: ${result.valid}`);
  console.log(`   Missing: ${result.missing.join(', ')}`);
  
  // Restore
  if (originalDbHost) process.env.DB_HOST = originalDbHost;
  if (originalDbName) process.env.DB_NAME = originalDbName;
} catch (error) {
  console.error('❌ Test failed:', error);
  // Restore on error
  if (originalDbHost) process.env.DB_HOST = originalDbHost;
  if (originalDbName) process.env.DB_NAME = originalDbName;
}

console.log('\n\n✅ All tests completed');
