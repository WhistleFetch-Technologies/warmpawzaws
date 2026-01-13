/**
 * ============================================================================
 * WARMPAWZ PLATFORM HARDENING TEST LEDGER
 * ============================================================================
 * 
 * Mandatory ledger tracking all 120 hardening tests
 * Each test must pass or be fixed before completion
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

export interface HardeningTest {
  testId: string; // H-001 to H-120
  category: string;
  layer: number; // 1-7
  failureInjected: string;
  expectedResilience: string;
  actualBehavior?: string;
  issueId?: string;
  fixApplied?: string;
  regressionImpact?: string;
  status: 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'BLOCKED';
  notes?: string;
}

export const HARDENING_TEST_LEDGER: HardeningTest[] = [];

export function registerHardeningTest(test: HardeningTest): void {
  const existing = HARDENING_TEST_LEDGER.find(t => t.testId === test.testId);
  if (existing) {
    Object.assign(existing, test);
  } else {
    HARDENING_TEST_LEDGER.push(test);
  }
}

export function updateTestStatus(testId: string, updates: Partial<HardeningTest>): void {
  const test = HARDENING_TEST_LEDGER.find(t => t.testId === testId);
  if (test) {
    Object.assign(test, updates);
  }
}

export function getTestsByLayer(layer: number): HardeningTest[] {
  return HARDENING_TEST_LEDGER.filter(t => t.layer === layer);
}

export function getTestsByStatus(status: HardeningTest['status']): HardeningTest[] {
  return HARDENING_TEST_LEDGER.filter(t => t.status === status);
}

export function getFailedTests(): HardeningTest[] {
  return HARDENING_TEST_LEDGER.filter(t => t.status === 'FAIL');
}

export function getAllTestsPassed(): boolean {
  return HARDENING_TEST_LEDGER.length === 120 && 
         HARDENING_TEST_LEDGER.every(t => t.status === 'PASS');
}
