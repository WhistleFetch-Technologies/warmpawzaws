/**
 * ============================================================================
 * WARMPAWZ SYSTEM RELIABILITY TEST EXECUTOR
 * ============================================================================
 * 
 * Main test execution orchestrator for 100-test suite
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import { testRegistry } from './test-registry';
import { TestFramework } from './test-framework';
import { registerCategoryATests } from './test-definitions-category-a';
import { registerCategoryBTests } from './test-definitions-category-b';
import { registerCategoryCTests } from './test-definitions-category-c';
import { registerCategoryDTests } from './test-definitions-category-d';
import { registerCategoryETests } from './test-definitions-category-e';
import { registerCategoryFTests } from './test-definitions-category-f';
import { registerCategoryGTests } from './test-definitions-category-g';
import { registerCategoryHTests } from './test-definitions-category-h';

export class TestExecutor {
  private framework: TestFramework;
  private stopOnFailure: boolean = false;

  constructor(apiBaseUrl?: string) {
    this.framework = new TestFramework(apiBaseUrl);
  }

  /**
   * Register all 100 tests
   */
  registerAllTests(): void {
    registerCategoryATests();
    registerCategoryBTests();
    registerCategoryCTests();
    registerCategoryDTests();
    registerCategoryETests();
    registerCategoryFTests();
    registerCategoryGTests();
    registerCategoryHTests();

    const summary = testRegistry.getSummary();
    if (summary.total !== 100) {
      throw new Error(`Expected 100 tests, but registered ${summary.total}`);
    }
    console.log(`✅ Registered ${summary.total} tests`);
  }

  /**
   * Execute all tests
   */
  async executeAllTests(): Promise<void> {
    console.log('\n🚀 Starting 100-Test System Reliability Suite...\n');

    const allTests = testRegistry.getAllTests();
    let passed = 0;
    let failed = 0;

    for (const test of allTests) {
      try {
        console.log(`[${test.testId}] Executing: ${test.journeyType}...`);
        
        this.framework.resetContext();
        const result = await this.framework.executeTest(test.testId);

        if (result.passed) {
          passed++;
          console.log(`✅ [${test.testId}] PASSED (${result.executionTimeMs}ms)`);
        } else {
          failed++;
          console.log(`❌ [${test.testId}] FAILED: ${result.errorDetails}`);
          
          if (this.stopOnFailure) {
            throw new Error(`Test ${test.testId} failed. Stopping execution.`);
          }
        }
      } catch (error: any) {
        failed++;
        console.error(`💥 [${test.testId}] EXCEPTION: ${error.message}`);
        
        if (this.stopOnFailure) {
          throw error;
        }
      }
    }

    console.log(`\n📊 Execution Summary:`);
    console.log(`   Total: ${allTests.length}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
  }

  /**
   * Execute tests by category
   */
  async executeCategory(category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'): Promise<void> {
    const tests = testRegistry.getTestsByCategory(category);
    console.log(`\n🚀 Executing Category ${category} (${tests.length} tests)...\n`);

    for (const test of tests) {
      try {
        console.log(`[${test.testId}] Executing: ${test.journeyType}...`);
        
        this.framework.resetContext();
        const result = await this.framework.executeTest(test.testId);

        if (result.passed) {
          console.log(`✅ [${test.testId}] PASSED (${result.executionTimeMs}ms)`);
        } else {
          console.log(`❌ [${test.testId}] FAILED: ${result.errorDetails}`);
        }
      } catch (error: any) {
        console.error(`💥 [${test.testId}] EXCEPTION: ${error.message}`);
      }
    }
  }

  /**
   * Re-run failed tests
   */
  async rerunFailedTests(): Promise<void> {
    const failedTests = testRegistry.getFailedTests();
    
    if (failedTests.length === 0) {
      console.log('✅ No failed tests to re-run');
      return;
    }

    console.log(`\n🔄 Re-running ${failedTests.length} failed tests...\n`);

    for (const test of failedTests) {
      try {
        console.log(`[${test.testId}] Re-running: ${test.journeyType}...`);
        
        this.framework.resetContext();
        const result = await this.framework.executeTest(test.testId);

        if (result.passed && test.issueId) {
          testRegistry.verifyFix(test.issueId, test.testId, 'PASS');
          console.log(`✅ [${test.testId}] FIXED - Now passing`);
        } else {
          console.log(`❌ [${test.testId}] Still failing: ${result.errorDetails}`);
        }
      } catch (error: any) {
        console.error(`💥 [${test.testId}] EXCEPTION: ${error.message}`);
      }
    }
  }

  /**
   * Execute until all pass
   */
  async executeUntilAllPass(maxIterations: number = 10): Promise<void> {
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n🔄 Iteration ${iteration}/${maxIterations}\n`);

      await this.executeAllTests();

      const summary = testRegistry.getSummary();
      if (summary.failed === 0) {
        console.log('\n🎉 All tests passing!');
        break;
      }

      if (iteration < maxIterations) {
        console.log(`\n⚠️  ${summary.failed} tests still failing. Analyzing issues...`);
        // Here you would implement issue analysis and fixes
        await this.rerunFailedTests();
      }
    }

    const finalSummary = testRegistry.getSummary();
    if (finalSummary.failed > 0) {
      throw new Error(`Failed to achieve 100/100 PASS after ${maxIterations} iterations. ${finalSummary.failed} tests still failing.`);
    }
  }
}
