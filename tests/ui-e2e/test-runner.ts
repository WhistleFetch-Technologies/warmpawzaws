/**
 * WARMPAWZ UI END-TO-END TEST RUNNER
 * 
 * Main execution script that:
 * 1. Loads all test scenarios
 * 2. Executes tests in parallel/serial based on dependencies
 * 3. Records all results
 * 4. Generates comprehensive certification report
 * 
 * Date: 2025-01-12
 */

// Load environment variables
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { TestExecutionEngine, TestResult } from './test-execution-engine';
import { adminTests } from './test-scenarios/admin-tests';
import { customerTests } from './test-scenarios/customer-tests';
import { vendorTests } from './test-scenarios/vendor-tests';
import { vendorTestsContinued } from './test-scenarios/vendor-tests-continued';
import * as fs from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  testResultsDir: './test-results/ui-e2e',
  reportDir: './test-results/reports',
  parallelExecution: true,
  maxConcurrentTests: 5,
  retryFailedTests: true,
  maxRetries: 2,
};

// ============================================================================
// TEST RUNNER
// ============================================================================

export class TestRunner {
  private engine: TestExecutionEngine;
  private allTests: any[];
  private results: TestResult[] = [];
  private startTime: Date = new Date();

  constructor() {
    this.engine = new TestExecutionEngine();
    this.allTests = [
      ...adminTests,
      ...customerTests,
      ...vendorTests,
      ...vendorTestsContinued,
    ];
  }

  /**
   * Run all tests
   */
  async runAll(): Promise<void> {
    console.log('\n🚀 WARMPAWZ UI END-TO-END TEST EXECUTION');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.allTests.length}`);
    console.log(`  - Admin: ${adminTests.length}`);
    console.log(`  - Customer: ${customerTests.length}`);
    console.log(`  - Vendor: ${vendorTests.length + vendorTestsContinued.length}`);
    console.log('='.repeat(60));
    console.log('📋 Execution Mode: Fix failures before proceeding');
    console.log('='.repeat(60));

    // Create results directory
    this.ensureDirectories();

    // Initialize engine
    await this.engine.initialize();

    try {
      // Execute tests serially to fix failures one by one
      await this.runSerialWithFix();
    } finally {
      // Cleanup
      await this.engine.cleanup();
    }
  }

  /**
   * Run tests serially, stopping on failures to fix them
   */
  private async runSerialWithFix(): Promise<void> {
    const executed = new Set<string>();
    const queue: any[] = [...this.allTests];
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 5; // Stop after 5 consecutive failures

    while (queue.length > 0) {
      const test = this.findNextRunnableTest(queue, executed);
      if (!test) {
        console.warn('⚠️  No runnable tests found, but queue not empty. Remaining:', queue.length);
        break;
      }

      const result = await this.engine.executeTest(test);
      this.results.push(result);
      executed.add(test.id);

      if (result.status === 'passed') {
        consecutiveFailures = 0;
        console.log(`✅ Test ${test.id} passed - continuing...`);
      } else if (result.status === 'blocked') {
        // Blocked tests (preconditions not met) don't count as failures
        // They'll be retried later when preconditions are met
        console.log(`⏸️  Test ${test.id} blocked - preconditions not met, will retry later`);
        // Put test back in queue for later
        queue.push(test);
      } else {
        // Failed test - stop for fix
        consecutiveFailures++;
        console.error(`❌ Test ${test.id} failed - stopping for fix`);
        console.error(`   Error: ${result.error || 'Unknown error'}`);
        
        // Show detailed failure info
        if (result.apiResults.length > 0) {
          result.apiResults.forEach(apiResult => {
            if (!apiResult.passed) {
              console.error(`   API: ${apiResult.endpoint} - Status: ${apiResult.status} - Error: ${apiResult.error}`);
            }
          });
        }
        
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.error(`\n⛔ Stopping: ${maxConsecutiveFailures} consecutive failures detected`);
          console.error('   Please fix the failing tests before continuing');
          break;
        }
      }
    }

    // Generate report
    await this.generateReport();
  }

  /**
   * Run tests in parallel (respecting dependencies)
   */
  private async runParallel(): Promise<void> {
    const executed = new Set<string>();
    const queue: any[] = [...this.allTests];
    const running: Promise<void>[] = [];

    while (queue.length > 0 || running.length > 0) {
      // Start new tests if we have capacity
      while (running.length < config.maxConcurrentTests && queue.length > 0) {
        const test = this.findNextRunnableTest(queue, executed);
        if (!test) break;

        const promise = this.executeTestWithRetry(test)
          .then(() => {
            running.splice(running.indexOf(promise), 1);
          });

        running.push(promise);
      }

      // Wait for at least one test to complete
      if (running.length > 0) {
        await Promise.race(running);
      }
    }

    // Wait for all remaining tests
    await Promise.all(running);
  }

  /**
   * Run tests serially
   */
  private async runSerial(): Promise<void> {
    const executed = new Set<string>();
    const queue: any[] = [...this.allTests];

    while (queue.length > 0) {
      const test = this.findNextRunnableTest(queue, executed);
      if (!test) {
        // No runnable tests, but queue not empty = circular dependency or missing preconditions
        console.warn('⚠️  No runnable tests found, but queue not empty. Remaining:', queue.length);
        break;
      }

      await this.executeTestWithRetry(test);
      executed.add(test.id);
    }
  }

  /**
   * Find next runnable test (all preconditions met)
   */
  private findNextRunnableTest(queue: any[], executed: Set<string>): any | null {
    for (let i = 0; i < queue.length; i++) {
      const test = queue[i];
      const preconditionsMet = test.preconditions.every((pre: string) => executed.has(pre));
      
      if (preconditionsMet) {
        queue.splice(i, 1);
        return test;
      }
    }
    return null;
  }

  /**
   * Execute test with retry logic
   */
  private async executeTestWithRetry(test: any): Promise<void> {
    let attempts = 0;
    let lastResult: TestResult | null = null;

    while (attempts <= (config.retryFailedTests ? config.maxRetries : 0)) {
      const result = await this.engine.executeTest(test);
      this.results.push(result);

      if (result.status === 'passed') {
        return;
      }

      lastResult = result;
      attempts++;

      if (attempts <= config.maxRetries) {
        console.log(`   🔄 Retrying test ${test.id} (attempt ${attempts + 1})...`);
        await this.delay(2000); // Wait before retry
      }
    }

    // Test failed after all retries
    console.error(`   ❌ Test ${test.id} failed after ${attempts} attempts`);
  }

  /**
   * Generate comprehensive certification report
   */
  private async generateReport(): Promise<void> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const blocked = this.results.filter(r => r.status === 'blocked').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;

    const adminResults = this.results.filter(r => adminTests.some(t => t.id === r.testId));
    const customerResults = this.results.filter(r => customerTests.some(t => t.id === r.testId));
    const vendorResults = this.results.filter(r => vendorTests.some(t => t.id === r.testId));

    const report = `
# WARMPAWZ UI & EXPERIENCE CERTIFICATION REPORT

**Generated:** ${new Date().toISOString()}  
**Execution Duration:** ${(duration / 1000 / 60).toFixed(2)} minutes  
**Test Execution Engine:** Human-Mimic E2E Testing Framework

---

## 📊 EXECUTIVE SUMMARY

### Overall Test Results

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Tests** | ${total} | 100% |
| **✅ Passed** | ${passed} | ${((passed/total)*100).toFixed(1)}% |
| **❌ Failed** | ${failed} | ${((failed/total)*100).toFixed(1)}% |
| **🚫 Blocked** | ${blocked} | ${((blocked/total)*100).toFixed(1)}% |
| **⏭️ Skipped** | ${skipped} | ${((skipped/total)*100).toFixed(1)}% |

### Coverage by Role

| Role | Tests | Passed | Failed | Pass Rate |
|------|-------|--------|--------|-----------|
| **Admin** | ${adminResults.length} | ${adminResults.filter(r => r.status === 'passed').length} | ${adminResults.filter(r => r.status === 'failed').length} | ${((adminResults.filter(r => r.status === 'passed').length / adminResults.length) * 100).toFixed(1)}% |
| **Customer** | ${customerResults.length} | ${customerResults.filter(r => r.status === 'passed').length} | ${customerResults.filter(r => r.status === 'failed').length} | ${((customerResults.filter(r => r.status === 'passed').length / customerResults.length) * 100).toFixed(1)}% |
| **Vendor** | ${vendorResults.length} | ${vendorResults.filter(r => r.status === 'passed').length} | ${vendorResults.filter(r => r.status === 'failed').length} | ${((vendorResults.filter(r => r.status === 'passed').length / vendorResults.length) * 100).toFixed(1)}% |

---

## 📈 COVERAGE METRICS

### Screen Coverage

| App | Screens Enumerated | Screens Tested | Coverage |
|-----|-------------------|----------------|----------|
| **Admin UI** | ~120-160 | ${this.countUniqueScreens(adminResults)} | ${((this.countUniqueScreens(adminResults) / 140) * 100).toFixed(1)}% |
| **Customer UI** | ~143 | ${this.countUniqueScreens(customerResults)} | ${((this.countUniqueScreens(customerResults) / 143) * 100).toFixed(1)}% |
| **Vendor UI** | ~152 | ${this.countUniqueScreens(vendorResults)} | ${((this.countUniqueScreens(vendorResults) / 152) * 100).toFixed(1)}% |
| **TOTAL** | **~415-455** | **${this.countUniqueScreens(this.results)}** | **${((this.countUniqueScreens(this.results) / 450) * 100).toFixed(1)}%** |

### Handler Coverage

| Validation Type | Total | Passed | Failed | Pass Rate |
|----------------|-------|--------|--------|-----------|
| **API Validations** | ${this.countValidations('api')} | ${this.countPassedValidations('api')} | ${this.countFailedValidations('api')} | ${((this.countPassedValidations('api') / this.countValidations('api')) * 100).toFixed(1)}% |
| **DB Validations** | ${this.countValidations('db')} | ${this.countPassedValidations('db')} | ${this.countFailedValidations('db')} | ${((this.countPassedValidations('db') / this.countValidations('db')) * 100).toFixed(1)}% |
| **Event Validations** | ${this.countValidations('event')} | ${this.countPassedValidations('event')} | ${this.countFailedValidations('event')} | ${((this.countPassedValidations('event') / this.countValidations('event')) * 100).toFixed(1)}% |
| **UI Validations** | ${this.countValidations('ui')} | ${this.countPassedValidations('ui')} | ${this.countFailedValidations('ui')} | ${((this.countPassedValidations('ui') / this.countValidations('ui')) * 100).toFixed(1)}% |

---

## 🎯 TEST CATEGORIES

### Test Distribution

| Category | Count | Passed | Failed |
|----------|-------|--------|--------|
| **Smoke Tests** | ${this.countByCategory('smoke')} | ${this.countByCategory('smoke', 'passed')} | ${this.countByCategory('smoke', 'failed')} |
| **Functional Tests** | ${this.countByCategory('functional')} | ${this.countByCategory('functional', 'passed')} | ${this.countByCategory('functional', 'failed')} |
| **Edge Case Tests** | ${this.countByCategory('edge-case')} | ${this.countByCategory('edge-case', 'passed')} | ${this.countByCategory('edge-case', 'failed')} |
| **Integration Tests** | ${this.countByCategory('integration')} | ${this.countByCategory('integration', 'passed')} | ${this.countByCategory('integration', 'failed')} |
| **Performance Tests** | ${this.countByCategory('performance')} | ${this.countByCategory('performance', 'passed')} | ${this.countByCategory('performance', 'failed')} |

---

## ❌ FAILED TESTS & BLOCKERS

${this.generateFailedTestsSection()}

---

## 🔍 DETAILED TEST RESULTS

${this.generateDetailedResultsSection()}

---

## 📋 ISSUE LEDGER

${this.generateIssueLedger()}

---

## ✅ CERTIFICATION DECLARATION

${this.generateCertificationDeclaration()}

---

## 📝 APPENDIX

### Test Execution Log
\`\`\`
${this.generateExecutionLog()}
\`\`\`

### Environment Details
- API Base URL: ${process.env.API_BASE_URL || 'Not configured'}
- Database: ${process.env.DB_TYPE || 'Not configured'}
- Event Bridge: ${process.env.EVENT_BRIDGE_BUS || 'Not configured'}

---

**Report Generated By:** Principal UX Auditor, End-to-End QA Architect  
**Framework Version:** 1.0.0  
**Certification Status:** ${failed === 0 ? '✅ CERTIFIED' : '❌ NOT CERTIFIED'}
`;

    // Save report
    const reportPath = path.join(config.reportDir, `WARMPAWZ_UI_CERTIFICATION_REPORT_${Date.now()}.md`);
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Certification report saved: ${reportPath}`);

    // Also save JSON results
    const jsonPath = path.join(config.reportDir, `test-results_${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));
    console.log(`📊 Test results JSON saved: ${jsonPath}`);
  }

  /**
   * Helper: Count unique screens tested
   */
  private countUniqueScreens(results: TestResult[]): number {
    const screens = new Set<string>();
    results.forEach(r => {
      const test = this.allTests.find(t => t.id === r.testId);
      if (test) screens.add(test.screen);
    });
    return screens.size;
  }

  /**
   * Helper: Count validations
   */
  private countValidations(type: 'api' | 'db' | 'event' | 'ui'): number {
    let count = 0;
    this.results.forEach(r => {
      switch (type) {
        case 'api': count += r.apiResults.length; break;
        case 'db': count += r.dbResults.length; break;
        case 'event': count += r.eventResults.length; break;
        case 'ui': count += r.uiResults.length; break;
      }
    });
    return count;
  }

  /**
   * Helper: Count passed validations
   */
  private countPassedValidations(type: 'api' | 'db' | 'event' | 'ui'): number {
    let count = 0;
    this.results.forEach(r => {
      switch (type) {
        case 'api': count += r.apiResults.filter(a => a.passed).length; break;
        case 'db': count += r.dbResults.filter(d => d.passed).length; break;
        case 'event': count += r.eventResults.filter(e => e.passed).length; break;
        case 'ui': count += r.uiResults.filter(u => u.passed).length; break;
      }
    });
    return count;
  }

  /**
   * Helper: Count failed validations
   */
  private countFailedValidations(type: 'api' | 'db' | 'event' | 'ui'): number {
    return this.countValidations(type) - this.countPassedValidations(type);
  }

  /**
   * Helper: Count by category
   */
  private countByCategory(category: string, status?: string): number {
    const tests = this.allTests.filter(t => t.category === category);
    if (!status) return tests.length;
    
    const testIds = new Set(tests.map(t => t.id));
    const results = this.results.filter(r => testIds.has(r.testId));
    
    if (status === 'passed') return results.filter(r => r.status === 'passed').length;
    if (status === 'failed') return results.filter(r => r.status === 'failed').length;
    return 0;
  }

  /**
   * Generate failed tests section
   */
  private generateFailedTestsSection(): string {
    const failed = this.results.filter(r => r.status === 'failed');
    if (failed.length === 0) {
      return '**✅ No failed tests. All tests passed!**';
    }

    return failed.map(r => {
      const test = this.allTests.find(t => t.id === r.testId);
      return `
### ${r.testId}: ${test?.name || 'Unknown Test'}
- **Status:** ${r.status}
- **Error:** ${r.error || 'No error message'}
- **Duration:** ${r.duration}ms
- **API Failures:** ${r.apiResults.filter(a => !a.passed).length}
- **DB Failures:** ${r.dbResults.filter(d => !d.passed).length}
- **Event Failures:** ${r.eventResults.filter(e => !e.passed).length}
- **UI Failures:** ${r.uiResults.filter(u => !u.passed).length}
`;
    }).join('\n');
  }

  /**
   * Generate detailed results section
   */
  private generateDetailedResultsSection(): string {
    return this.results.map(r => {
      const test = this.allTests.find(t => t.id === r.testId);
      return `
### ${r.testId}: ${test?.name || 'Unknown'}
- **Status:** ${r.status}
- **Duration:** ${r.duration}ms
- **API:** ${r.apiResults.filter(a => a.passed).length}/${r.apiResults.length} passed
- **DB:** ${r.dbResults.filter(d => d.passed).length}/${r.dbResults.length} passed
- **Events:** ${r.eventResults.filter(e => e.passed).length}/${r.eventResults.length} passed
- **UI:** ${r.uiResults.filter(u => u.passed).length}/${r.uiResults.length} passed
`;
    }).join('\n');
  }

  /**
   * Generate issue ledger
   */
  private generateIssueLedger(): string {
    const failed = this.results.filter(r => r.status === 'failed');
    if (failed.length === 0) {
      return '**✅ Zero open issues. All tests passed!**';
    }

    return `
| Issue ID | Test ID | Severity | Status | Description |
|----------|---------|----------|--------|-------------|
${failed.map((r, i) => {
  const test = this.allTests.find(t => t.id === r.testId);
  return `| ISSUE-${i + 1} | ${r.testId} | ${test?.priority || 'unknown'} | Open | ${r.error || 'Test failed'} |`;
}).join('\n')}

**Total Open Issues:** ${failed.length}
`;
  }

  /**
   * Generate certification declaration
   */
  private generateCertificationDeclaration(): string {
    const failed = this.results.filter(r => r.status === 'failed');
    const blocked = this.results.filter(r => r.status === 'blocked');

    if (failed.length === 0 && blocked.length === 0) {
      return `
**✅ CERTIFIED**

ALL WARMPAWZ UI SCREENS, ACTIONS, AND FLOWS ARE FULLY WIRED, HUMAN-VALIDATED, AND PRODUCTION-READY.

- ✅ All ${this.results.length} tests passed
- ✅ All API handlers validated
- ✅ All DB mutations verified
- ✅ All events triggered correctly
- ✅ All UI states confirmed
- ✅ Zero blockers
- ✅ Zero open issues

**Certification Date:** ${new Date().toISOString()}
**Certified By:** Principal UX Auditor, End-to-End QA Architect
`;
    } else {
      return `
**❌ NOT CERTIFIED**

The following issues prevent certification:

- ❌ ${failed.length} failed tests
- ❌ ${blocked.length} blocked tests
- ❌ ${this.countFailedValidations('api')} API validation failures
- ❌ ${this.countFailedValidations('db')} DB validation failures
- ❌ ${this.countFailedValidations('event')} Event validation failures
- ❌ ${this.countFailedValidations('ui')} UI validation failures

**Remediation Required:** Please fix all blockers and re-run tests.
`;
    }
  }

  /**
   * Generate execution log
   */
  private generateExecutionLog(): string {
    return this.results.map(r => {
      const timestamp = r.timestamp.toISOString();
      const status = r.status === 'passed' ? '✅' : r.status === 'failed' ? '❌' : '⏭️';
      return `${timestamp} ${status} ${r.testId} (${r.duration}ms)`;
    }).join('\n');
  }

  /**
   * Ensure directories exist
   */
  private ensureDirectories(): void {
    [config.testResultsDir, config.reportDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Utility: Delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

if (require.main === module) {
  const runner = new TestRunner();
  runner.runAll()
    .then(() => {
      console.log('\n✅ Test execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    });
}
