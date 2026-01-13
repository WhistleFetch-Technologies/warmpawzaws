#!/usr/bin/env node
/**
 * ============================================================================
 * WARMPAWZ SYSTEM RELIABILITY TEST SUITE - MAIN EXECUTOR
 * ============================================================================
 * 
 * Execute: npm run test:reliability
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import { TestExecutor } from './test-executor';
import { ReportGenerator } from './report-generator';
import { join } from 'path';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  WARMPAWZ SYSTEM RELIABILITY TEST SUITE                     ║');
  console.log('║  100 Complex Real-World Test Journeys                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Use deployed AWS API Gateway endpoint
  const apiBaseUrl = process.env.API_ENDPOINT || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  console.log(`🌐 Using API Endpoint: ${apiBaseUrl}`);
  const executor = new TestExecutor(apiBaseUrl);
  const reportGenerator = new ReportGenerator();

  try {
    // Register all 100 tests
    console.log('📝 Registering all tests...');
    executor.registerAllTests();

    // Execute all tests
    console.log('\n🚀 Executing test suite...');
    await executor.executeUntilAllPass(10);

    // Generate report
    console.log('\n📊 Generating comprehensive report...');
    const reportPath = join(process.cwd(), 'WARMPAWZ_ADVANCED_SYSTEM_RELIABILITY_REPORT.md');
    const report = reportGenerator.generateReport(reportPath);

    console.log('\n' + '='.repeat(70));
    console.log(report);
    console.log('='.repeat(70));

    const summary = require('./test-registry').testRegistry.getSummary();
    if (summary.failed === 0) {
      console.log('\n✅ ALL TESTS PASSED - SYSTEM IS UAT-READY');
      process.exit(0);
    } else {
      console.log(`\n❌ ${summary.failed} TESTS FAILED - SYSTEM REQUIRES FIXES`);
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
