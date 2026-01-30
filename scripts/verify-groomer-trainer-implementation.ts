/**
 * Verification Script for Groomer & Trainer Booking Implementation
 * This script verifies the implementation without requiring a running server
 */

import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

function checkFile(filePath: string, description: string): boolean {
  const fullPath = path.join(process.cwd(), filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    results.push({
      check: description,
      status: 'PASS',
      message: `File exists: ${filePath}`,
    });
    return true;
  } else {
    results.push({
      check: description,
      status: 'FAIL',
      message: `File missing: ${filePath}`,
    });
    return false;
  }
}

function checkFileContent(filePath: string, searchString: string, description: string): boolean {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    results.push({
      check: description,
      status: 'FAIL',
      message: `File not found: ${filePath}`,
    });
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const found = content.includes(searchString);
  
  if (found) {
    results.push({
      check: description,
      status: 'PASS',
      message: `Found: ${searchString}`,
      details: filePath,
    });
    return true;
  } else {
    results.push({
      check: description,
      status: 'FAIL',
      message: `Not found: ${searchString}`,
      details: filePath,
    });
    return false;
  }
}

function verifyImplementation() {
  console.log('🔍 Verifying Groomer & Trainer Booking Implementation\n');
  console.log('='.repeat(60));
  
  // Check component files
  console.log('\n📁 Checking Component Files...\n');
  
  checkFile(
    'apps/customer-web/components/customer/groomer/GroomerBookingRouter.tsx',
    'GroomerBookingRouter component'
  );
  
  checkFile(
    'apps/customer-web/components/customer/groomer/GroomerBookingFlow.tsx',
    'GroomerBookingFlow component'
  );
  
  checkFile(
    'apps/customer-web/components/customer/trainer/TrainerBookingRouter.tsx',
    'TrainerBookingRouter component'
  );
  
  checkFile(
    'apps/customer-web/components/customer/trainer/TrainerBookingFlow.tsx',
    'TrainerBookingFlow component'
  );
  
  // Check integration in CustomerHomeWrapper
  console.log('\n🔗 Checking Integration...\n');
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'GroomerBookingRouter',
    'GroomerBookingRouter imported in CustomerHomeWrapper'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'TrainerBookingRouter',
    'TrainerBookingRouter imported in CustomerHomeWrapper'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'grooming-booking',
    'grooming-booking screen handler'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'training-booking',
    'training-booking screen handler'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'roleId="groomer"',
    'Groomer roleId in UniversalServicesByStyle'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'roleId="trainer"',
    'Trainer roleId in UniversalServicesByStyle'
  );
  
  // Check component implementations
  console.log('\n🔍 Checking Component Implementations...\n');
  
  checkFileContent(
    'apps/customer-web/components/customer/groomer/GroomerBookingRouter.tsx',
    'roleId="groomer"',
    'GroomerBookingRouter uses roleId="groomer"'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/groomer/GroomerBookingRouter.tsx',
    'UniversalBookingRouter',
    'GroomerBookingRouter wraps UniversalBookingRouter'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/trainer/TrainerBookingRouter.tsx',
    'roleId="trainer"',
    'TrainerBookingRouter uses roleId="trainer"'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/trainer/TrainerBookingRouter.tsx',
    'UniversalBookingRouter',
    'TrainerBookingRouter wraps UniversalBookingRouter'
  );
  
  // Check role configuration
  console.log('\n⚙️  Checking Role Configuration...\n');
  
  checkFileContent(
    'apps/customer-web/components/customer/shared/roleConfig.ts',
    'groomer:',
    'Groomer role configuration'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/shared/roleConfig.ts',
    'trainer:',
    'Trainer role configuration'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/shared/roleConfig.ts',
    'at_home',
    'at_home service style configured'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/shared/roleConfig.ts',
    'at_center',
    'at_center service style configured'
  );
  
  // Check navigation support
  console.log('\n🧭 Checking Navigation Support...\n');
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'appointment',
    'Appointment navigation support'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'grooming_center',
    'grooming_center screen'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'grooming_home',
    'grooming_home screen'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'training_center',
    'training_center screen'
  );
  
  checkFileContent(
    'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx',
    'training_home',
    'training_home screen'
  );
  
  // Summary
  console.log('\n\n📊 Verification Summary\n');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📊 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Checks:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.check}: ${r.message}`);
      if (r.details) console.log(`     File: ${r.details}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Save results
  fs.writeFileSync(
    'groomer-trainer-verification-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Results saved to: groomer-trainer-verification-results.json');
  
  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

verifyImplementation();
