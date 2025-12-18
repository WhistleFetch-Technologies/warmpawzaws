/**
 * 🚀 TEST EXECUTION MASTER RUNNER
 * 
 * Runs all test suites and generates comprehensive report
 * 
 * Usage:
 * - npm run test:all (runs everything)
 * - npm run test:api (API tests only)
 * - npm run test:e2e (E2E tests only)
 */

import { runAllTests as runAPITests } from './api-integration-tests';
import { runAllE2EFlows } from './e2e-flow-tests';

interface TestSuiteResult {
  suite: string;
  status: 'pass' | 'fail';
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  successRate: string;
}

/**
 * MASTER TEST RUNNER
 */
export async function runAllTestSuites() {
  console.log('\n' + '═'.repeat(80));
  console.log('🚀 WARMPAWZ COMPREHENSIVE TEST SUITE');
  console.log('═'.repeat(80));
  console.log(`Started at: ${new Date().toLocaleString()}`);
  console.log('═'.repeat(80) + '\n');

  const overallStartTime = Date.now();
  const results: TestSuiteResult[] = [];

  // ============================================
  // SUITE 1: API INTEGRATION TESTS
  // ============================================
  console.log('\n📦 SUITE 1: API INTEGRATION TESTS');
  console.log('─'.repeat(80));

  const apiStartTime = Date.now();
  let apiResult: TestSuiteResult;

  try {
    const apiTestResults = await runAPITests();
    
    apiResult = {
      suite: 'API Integration Tests',
      status: apiTestResults.failed === 0 ? 'pass' : 'fail',
      totalTests: apiTestResults.total,
      passed: apiTestResults.passed,
      failed: apiTestResults.failed,
      duration: Date.now() - apiStartTime,
      successRate: apiTestResults.successRate
    };

    results.push(apiResult);

  } catch (error) {
    console.error('❌ API Test Suite Failed:', error);
    apiResult = {
      suite: 'API Integration Tests',
      status: 'fail',
      totalTests: 0,
      passed: 0,
      failed: 1,
      duration: Date.now() - apiStartTime,
      successRate: '0%'
    };
    results.push(apiResult);
  }

  // ============================================
  // SUITE 2: END-TO-END FLOW TESTS
  // ============================================
  console.log('\n📦 SUITE 2: END-TO-END FLOW TESTS');
  console.log('─'.repeat(80));

  const e2eStartTime = Date.now();
  let e2eResult: TestSuiteResult;

  try {
    const e2eTestResults = await runAllE2EFlows();
    
    const totalFlows = e2eTestResults.length;
    const passedFlows = e2eTestResults.filter(r => r.status === 'pass').length;
    const failedFlows = e2eTestResults.filter(r => r.status === 'fail').length;

    e2eResult = {
      suite: 'E2E Flow Tests',
      status: failedFlows === 0 ? 'pass' : 'fail',
      totalTests: totalFlows,
      passed: passedFlows,
      failed: failedFlows,
      duration: Date.now() - e2eStartTime,
      successRate: `${((passedFlows / totalFlows) * 100).toFixed(2)}%`
    };

    results.push(e2eResult);

  } catch (error) {
    console.error('❌ E2E Test Suite Failed:', error);
    e2eResult = {
      suite: 'E2E Flow Tests',
      status: 'fail',
      totalTests: 0,
      passed: 0,
      failed: 1,
      duration: Date.now() - e2eStartTime,
      successRate: '0%'
    };
    results.push(e2eResult);
  }

  // ============================================
  // FINAL SUMMARY
  // ============================================
  const overallDuration = Date.now() - overallStartTime;

  console.log('\n' + '═'.repeat(80));
  console.log('📊 COMPREHENSIVE TEST EXECUTION SUMMARY');
  console.log('═'.repeat(80));

  // Overall Stats
  const totalTests = results.reduce((sum, r) => sum + r.totalTests, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const overallSuccessRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : '0';

  console.log(`\n🔢 Overall Statistics:`);
  console.log(`   Total Test Suites: ${results.length}`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   ✅ Passed: ${totalPassed}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log(`   Success Rate: ${overallSuccessRate}%`);
  console.log(`   Duration: ${(overallDuration / 1000).toFixed(2)}s`);

  // Suite Breakdown
  console.log(`\n📦 Test Suite Breakdown:`);
  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : '❌';
    console.log(`\n   ${icon} ${result.suite}`);
    console.log(`      Tests: ${result.passed}/${result.totalTests} passed`);
    console.log(`      Success Rate: ${result.successRate}`);
    console.log(`      Duration: ${(result.duration / 1000).toFixed(2)}s`);
  });

  // Failed Suites
  const failedSuites = results.filter(r => r.status === 'fail');
  if (failedSuites.length > 0) {
    console.log(`\n⚠️  Failed Test Suites:`);
    failedSuites.forEach(suite => {
      console.log(`   ❌ ${suite.suite}: ${suite.failed} failures`);
    });
  }

  // Production Readiness
  console.log(`\n🎯 Production Readiness Assessment:`);
  
  const allPassed = results.every(r => r.status === 'pass');
  const highSuccessRate = parseFloat(overallSuccessRate) >= 95;

  if (allPassed && highSuccessRate) {
    console.log(`   ✅ READY FOR PRODUCTION`);
    console.log(`   All test suites passed with ${overallSuccessRate}% success rate.`);
  } else if (highSuccessRate) {
    console.log(`   🟡 MOSTLY READY`);
    console.log(`   ${overallSuccessRate}% tests passing. Review failed tests before launch.`);
  } else {
    console.log(`   ❌ NOT READY`);
    console.log(`   Only ${overallSuccessRate}% tests passing. Critical issues need resolution.`);
  }

  console.log(`\n📅 Completed at: ${new Date().toLocaleString()}`);
  console.log('═'.repeat(80) + '\n');

  // Return results for programmatic access
  return {
    overallStatus: allPassed && highSuccessRate ? 'pass' : 'fail',
    totalTests,
    totalPassed,
    totalFailed,
    overallSuccessRate,
    duration: overallDuration,
    suites: results
  };
}

/**
 * Generate HTML Test Report
 */
export function generateHTMLReport(results: any) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Warmpawz Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #FF8C42; margin-bottom: 10px; }
    .timestamp { color: #666; margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
    .stat-card.pass { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .stat-card.fail { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
    .stat-label { font-size: 14px; opacity: 0.9; margin-bottom: 5px; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .suite-card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #FF8C42; }
    .suite-card.pass { border-left-color: #38ef7d; }
    .suite-card.fail { border-left-color: #f45c43; }
    .suite-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .suite-name { font-size: 18px; font-weight: 600; }
    .badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge.pass { background: #d4edda; color: #155724; }
    .badge.fail { background: #f8d7da; color: #721c24; }
    .suite-stats { display: flex; gap: 20px; font-size: 14px; color: #666; }
    .readiness { background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3; margin-top: 30px; }
    .readiness.ready { background: #d4edda; border-left-color: #28a745; }
    .readiness.not-ready { background: #f8d7da; border-left-color: #dc3545; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 Warmpawz Test Execution Report</h1>
    <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
    
    <div class="summary">
      <div class="stat-card">
        <div class="stat-label">Total Tests</div>
        <div class="stat-value">${results.totalTests}</div>
      </div>
      <div class="stat-card pass">
        <div class="stat-label">Passed</div>
        <div class="stat-value">${results.totalPassed}</div>
      </div>
      <div class="stat-card fail">
        <div class="stat-label">Failed</div>
        <div class="stat-value">${results.totalFailed}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Success Rate</div>
        <div class="stat-value">${results.overallSuccessRate}%</div>
      </div>
    </div>

    <h2 style="margin-bottom: 20px;">Test Suites</h2>
    ${results.suites.map((suite: TestSuiteResult) => `
      <div class="suite-card ${suite.status}">
        <div class="suite-header">
          <div class="suite-name">${suite.suite}</div>
          <span class="badge ${suite.status}">${suite.status.toUpperCase()}</span>
        </div>
        <div class="suite-stats">
          <span>✅ ${suite.passed} passed</span>
          <span>❌ ${suite.failed} failed</span>
          <span>📊 ${suite.successRate} success</span>
          <span>⏱️ ${(suite.duration / 1000).toFixed(2)}s</span>
        </div>
      </div>
    `).join('')}

    <div class="readiness ${results.overallStatus === 'pass' ? 'ready' : 'not-ready'}">
      <h2 style="margin-bottom: 10px;">
        ${results.overallStatus === 'pass' ? '✅ Ready for Production' : '⚠️ Not Ready for Production'}
      </h2>
      <p>
        ${results.overallStatus === 'pass' 
          ? `All test suites passed with ${results.overallSuccessRate}% success rate. Platform is production-ready.`
          : `Only ${results.overallSuccessRate}% of tests passing. Please review and fix failed tests before production deployment.`
        }
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Run tests if executed directly
 */
if (import.meta.main) {
  runAllTestSuites()
    .then(results => {
      console.log('\n✅ Test execution complete!');
      console.log(`\nTo generate HTML report, use:`);
      console.log(`  import { generateHTMLReport } from './run-all-tests';`);
      console.log(`  const html = generateHTMLReport(results);`);
      
      process.exit(results.overallStatus === 'pass' ? 0 : 1);
    })
    .catch(error => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { TestSuiteResult };
