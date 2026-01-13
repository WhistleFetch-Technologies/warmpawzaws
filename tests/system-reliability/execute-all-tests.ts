#!/usr/bin/env node
/**
 * ============================================================================
 * WARMPAWZ SYSTEM RELIABILITY TEST SUITE - FULL EXECUTION
 * ============================================================================
 * 
 * Executes all 100 tests against deployed AWS API Gateway
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import { TestExecutor } from './test-executor';
import { ReportGenerator } from './report-generator';
import { testRegistry } from './test-registry';
import { join } from 'path';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  WARMPAWZ SYSTEM RELIABILITY TEST SUITE                     ║');
  console.log('║  100 Complex Real-World Test Journeys                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Use deployed AWS API Gateway endpoint
  const apiBaseUrl = process.env.API_ENDPOINT || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  console.log(`🌐 Using API Endpoint: ${apiBaseUrl}\n`);

  const executor = new TestExecutor(apiBaseUrl);
  const reportGenerator = new ReportGenerator();

  try {
    // Register all 100 tests
    console.log('📝 Registering all tests...');
    executor.registerAllTests();
    const initialSummary = testRegistry.getSummary();
    console.log(`✅ Registered ${initialSummary.total} tests\n`);

    // Execute all tests
    console.log('🚀 Executing test suite...\n');
    await executor.executeAllTests();

    // Generate report
    console.log('\n📊 Generating comprehensive report...');
    const reportPath = join(process.cwd(), 'WARMPAWZ_ADVANCED_SYSTEM_RELIABILITY_REPORT.md');
    const report = reportGenerator.generateReport(reportPath);

    const finalSummary = testRegistry.getSummary();
    
    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 FINAL SUMMARY`);
    console.log(`   Total Tests: ${finalSummary.total}`);
    console.log(`   Passed: ${finalSummary.passed}`);
    console.log(`   Failed: ${finalSummary.failed}`);
    console.log(`   Issues Found: ${finalSummary.issues}`);
    console.log(`   Unresolved Issues: ${finalSummary.unresolvedIssues}`);
    console.log('\n' + '='.repeat(70));

    if (finalSummary.failed === 0 && finalSummary.unresolvedIssues === 0) {
      console.log('\n✅ ALL TESTS PASSED - SYSTEM IS UAT-READY');
      console.log(`\n📄 Full report: ${reportPath}\n`);
      process.exit(0);
    } else {
      console.log(`\n❌ ${finalSummary.failed} TESTS FAILED - SYSTEM REQUIRES FIXES`);
      console.log(`\n📄 Full report with issue details: ${reportPath}\n`);
      
      // Show failed tests
      const failedTests = testRegistry.getFailedTests();
      console.log('\n🔍 Failed Tests:');
      failedTests.slice(0, 10).forEach(test => {
        console.log(`   ${test.testId}: ${test.journeyType} - ${test.errorDetails?.substring(0, 100)}`);
      });
      if (failedTests.length > 10) {
        console.log(`   ... and ${failedTests.length - 10} more`);
      }
      
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n💥 FATAL ERROR:', error.message);
    console.error(error.stack);
    
    // Still generate report
    const reportPath = join(process.cwd(), 'WARMPAWZ_ADVANCED_SYSTEM_RELIABILITY_REPORT.md');
    reportGenerator.generateReport(reportPath);
    
    process.exit(1);
  }
}

main();
