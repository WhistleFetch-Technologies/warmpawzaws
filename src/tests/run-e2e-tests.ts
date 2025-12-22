/**
 * E2E Test Runner
 * 
 * Run this file to execute comprehensive E2E tests
 */

import { runE2EVendorJourneyTests } from './e2e-vendor-journey-test.ts';
import { runCustomerJourneyTests } from './e2e-customer-journey-test.ts';

// Run vendor journey tests
console.log('🚀 Starting E2E Vendor Journey Tests...\n');

runE2EVendorJourneyTests()
  .then((report) => {
    // Write report to file
    const encoder = new TextEncoder();
    const reportPath = './E2E_VENDOR_JOURNEY_TEST_REPORT.txt';
    // @ts-ignore - Deno global may not be available in all environments
    if (typeof (globalThis as any).Deno !== 'undefined') {
      (globalThis as any).Deno.writeFileSync(reportPath, encoder.encode(report));
      console.log(`\n📄 Report saved to: ${reportPath}`);
    }
    console.log('\n✅ Vendor Journey Tests Complete\n');
    
    // Run customer journey tests
    console.log('🚀 Starting E2E Customer Journey Tests...\n');
    return runCustomerJourneyTests();
  })
  .then((suites) => {
    console.log('\n📈 CUSTOMER JOURNEY TEST SUMMARY');
    console.log('='.repeat(80));
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    
    for (const suite of suites) {
      console.log(`\n${suite.suiteName}:`);
      console.log(`  Total: ${suite.totalTests}`);
      console.log(`  Passed: ${suite.passedTests}`);
      console.log(`  Failed: ${suite.failedTests}`);
      console.log(`  Skipped: ${suite.skippedTests}`);
      console.log(`  Duration: ${(suite.duration / 1000).toFixed(2)}s`);
      
      totalTests += suite.totalTests;
      totalPassed += suite.passedTests;
      totalFailed += suite.failedTests;
      totalSkipped += suite.skippedTests;
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`OVERALL: ${totalPassed}/${totalTests} passed, ${totalFailed} failed, ${totalSkipped} skipped`);
    console.log('='.repeat(80));
    
    // @ts-ignore - Deno global may not be available in all environments
    if (typeof (globalThis as any).Deno !== 'undefined') {
      (globalThis as any).Deno.exit(0);
    }
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    // @ts-ignore - Deno global may not be available in all environments
    if (typeof (globalThis as any).Deno !== 'undefined') {
      (globalThis as any).Deno.exit(1);
    }
  });

