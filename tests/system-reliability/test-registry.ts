/**
 * ============================================================================
 * WARMPAWZ SYSTEM RELIABILITY TEST REGISTRY
 * ============================================================================
 * 
 * 100-Test Registry for Enterprise-Grade System Validation
 * 
 * This registry tracks all 100 complex, rule-heavy, real-world test journeys
 * across all service types, vendors, financial rules, and edge conditions.
 * 
 * MANDATORY: No test may remain FAILED. No test may be skipped.
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

export interface TestRegistryEntry {
  testId: string; // T-001 to T-100
  journeyType: string;
  vendorType: string;
  serviceStyle: string;
  rulesInvolved: string[];
  preconditions: string[];
  executionSteps: string[];
  expectedOutcome: string;
  actualOutcome?: string;
  issueId?: string;
  fixReference?: string;
  rerunResult?: 'PASS' | 'FAIL';
  finalStatus: 'PASS' | 'FAIL' | 'PENDING' | 'IN_PROGRESS';
  category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  executedAt?: string;
  executionTimeMs?: number;
  errorDetails?: string;
}

export interface TestIssue {
  issueId: string;
  testId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  rootCause?: string;
  fixApplied?: string;
  fixVerified?: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export class TestRegistry {
  private tests: Map<string, TestRegistryEntry> = new Map();
  private issues: Map<string, TestIssue> = new Map();
  private issueCounter = 1;

  registerTest(test: Omit<TestRegistryEntry, 'finalStatus'>): void {
    this.tests.set(test.testId, {
      ...test,
      finalStatus: 'PENDING',
    });
  }

  updateTestResult(
    testId: string,
    result: 'PASS' | 'FAIL',
    actualOutcome?: string,
    errorDetails?: string,
    executionTimeMs?: number
  ): void {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found in registry`);
    }

    test.finalStatus = result;
    test.actualOutcome = actualOutcome;
    test.errorDetails = errorDetails;
    test.executedAt = new Date().toISOString();
    test.executionTimeMs = executionTimeMs;

    if (result === 'FAIL') {
      const issueId = `ISSUE-${String(this.issueCounter).padStart(3, '0')}`;
      this.issueCounter++;
      
      test.issueId = issueId;
      
      const issue: TestIssue = {
        issueId,
        testId,
        severity: this.determineSeverity(test),
        description: `Test ${testId} failed: ${errorDetails || actualOutcome || 'Unknown error'}`,
        createdAt: new Date().toISOString(),
      };
      
      this.issues.set(issueId, issue);
    }
  }

  markTestInProgress(testId: string): void {
    const test = this.tests.get(testId);
    if (test) {
      test.finalStatus = 'IN_PROGRESS';
    }
  }

  recordFix(issueId: string, fixApplied: string, rootCause?: string): void {
    const issue = this.issues.get(issueId);
    if (issue) {
      issue.fixApplied = fixApplied;
      issue.rootCause = rootCause;
    }
  }

  verifyFix(issueId: string, testId: string, rerunResult: 'PASS' | 'FAIL'): void {
    const issue = this.issues.get(issueId);
    const test = this.tests.get(testId);
    
    if (issue && test) {
      issue.fixVerified = rerunResult === 'PASS';
      issue.resolvedAt = rerunResult === 'PASS' ? new Date().toISOString() : undefined;
      
      test.rerunResult = rerunResult;
      test.fixReference = issueId;
      
      if (rerunResult === 'PASS') {
        test.finalStatus = 'PASS';
      }
    }
  }

  getTest(testId: string): TestRegistryEntry | undefined {
    return this.tests.get(testId);
  }

  getAllTests(): TestRegistryEntry[] {
    return Array.from(this.tests.values()).sort((a, b) => 
      a.testId.localeCompare(b.testId)
    );
  }

  getTestsByCategory(category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'): TestRegistryEntry[] {
    return this.getAllTests().filter(t => t.category === category);
  }

  getFailedTests(): TestRegistryEntry[] {
    return this.getAllTests().filter(t => t.finalStatus === 'FAIL');
  }

  getPassedTests(): TestRegistryEntry[] {
    return this.getAllTests().filter(t => t.finalStatus === 'PASS');
  }

  getAllIssues(): TestIssue[] {
    return Array.from(this.issues.values());
  }

  getUnresolvedIssues(): TestIssue[] {
    return this.getAllIssues().filter(i => !i.fixVerified);
  }

  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    pending: number;
    inProgress: number;
    issues: number;
    unresolvedIssues: number;
  } {
    const allTests = this.getAllTests();
    return {
      total: allTests.length,
      passed: allTests.filter(t => t.finalStatus === 'PASS').length,
      failed: allTests.filter(t => t.finalStatus === 'FAIL').length,
      pending: allTests.filter(t => t.finalStatus === 'PENDING').length,
      inProgress: allTests.filter(t => t.finalStatus === 'IN_PROGRESS').length,
      issues: this.getAllIssues().length,
      unresolvedIssues: this.getUnresolvedIssues().length,
    };
  }

  private determineSeverity(test: TestRegistryEntry): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    // Financial and tax tests are critical
    if (test.category === 'A') return 'CRITICAL';
    
    // Policy and refund tests are high
    if (test.category === 'B') return 'HIGH';
    
    // Service delivery tests are high
    if (test.category === 'C' || test.category === 'D') return 'HIGH';
    
    // Other tests are medium
    return 'MEDIUM';
  }
}

export const testRegistry = new TestRegistry();
