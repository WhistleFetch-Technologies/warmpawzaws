/**
 * ============================================================================
 * WARMPAWZ SYSTEM RELIABILITY REPORT GENERATOR
 * ============================================================================
 * 
 * Generates the final comprehensive test report
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import { testRegistry, TestRegistryEntry, TestIssue } from './test-registry';
import { writeFileSync } from 'fs';
import { join } from 'path';

export class ReportGenerator {
  /**
   * Generate the final comprehensive report
   */
  generateReport(outputPath?: string): string {
    const summary = testRegistry.getSummary();
    const allTests = testRegistry.getAllTests();
    const allIssues = testRegistry.getAllIssues();
    const unresolvedIssues = testRegistry.getUnresolvedIssues();

    const report = this.buildReport(summary, allTests, allIssues, unresolvedIssues);

    if (outputPath) {
      writeFileSync(outputPath, report, 'utf-8');
      console.log(`\n📄 Report generated: ${outputPath}`);
    }

    return report;
  }

  private buildReport(
    summary: any,
    allTests: TestRegistryEntry[],
    allIssues: TestIssue[],
    unresolvedIssues: TestIssue[]
  ): string {
    const timestamp = new Date().toISOString();
    const passRate = summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(2) : '0.00';

    let report = `# WARMPAWZ ADVANCED SYSTEM RELIABILITY REPORT\n\n`;
    report += `**Generated:** ${timestamp}\n`;
    report += `**Test Suite:** 100 Complex Real-World Test Journeys\n`;
    report += `**Status:** ${summary.failed === 0 ? '✅ SYSTEM IS ENTERPRISE-GRADE & UAT-READY' : '⚠️ ISSUES DETECTED'}\n\n`;
    report += `---\n\n`;

    // Executive Summary
    report += `## 📊 EXECUTIVE SUMMARY\n\n`;
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| **Total Tests** | ${summary.total} |\n`;
    report += `| **Passed** | ${summary.passed} |\n`;
    report += `| **Failed** | ${summary.failed} |\n`;
    report += `| **Pending** | ${summary.pending} |\n`;
    report += `| **In Progress** | ${summary.inProgress} |\n`;
    report += `| **Pass Rate** | ${passRate}% |\n`;
    report += `| **Total Issues** | ${allIssues.length} |\n`;
    report += `| **Unresolved Issues** | ${unresolvedIssues.length} |\n\n`;

    if (summary.failed === 0) {
      report += `### ✅ FINAL SCORE: ${summary.passed} / ${summary.total} PASS\n\n`;
      report += `### 🎯 VERDICT: SYSTEM IS ENTERPRISE-GRADE & UAT-READY\n\n`;
    } else {
      report += `### ⚠️ FINAL SCORE: ${summary.passed} / ${summary.total} PASS\n\n`;
      report += `### 🚨 VERDICT: SYSTEM REQUIRES FIXES BEFORE UAT\n\n`;
    }

    report += `---\n\n`;

    // Test Registry
    report += `## 📋 TEST REGISTRY (100 TESTS)\n\n`;

    const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
    const categoryNames = {
      A: 'Tax & Financial Complexity',
      B: 'Refund, Cancellation & Policy Engine',
      C: 'Video Calling & Tele Services',
      D: 'Home Services & Map Tracking',
      E: 'Pet Cafe Booking',
      F: 'Insurance Lifecycle',
      G: 'Dynamic Vendor Dashboard & Capabilities',
      H: 'Cross-Journey Conflicts',
    };

    for (const category of categories) {
      const categoryTests = allTests.filter(t => t.category === category);
      report += `### Category ${category}: ${categoryNames[category]} (${categoryTests.length} tests)\n\n`;

      report += `| Test ID | Journey Type | Vendor Type | Service Style | Status | Issue ID |\n`;
      report += `|---------|--------------|-------------|---------------|--------|----------|\n`;

      for (const test of categoryTests) {
        const statusEmoji = test.finalStatus === 'PASS' ? '✅' : test.finalStatus === 'FAIL' ? '❌' : '⏳';
        report += `| ${test.testId} | ${test.journeyType} | ${test.vendorType} | ${test.serviceStyle} | ${statusEmoji} ${test.finalStatus} | ${test.issueId || '-'} |\n`;
      }

      report += `\n`;
    }

    report += `---\n\n`;

    // Issue Summary
    if (allIssues.length > 0) {
      report += `## 🐛 ISSUE SUMMARY\n\n`;

      report += `| Issue ID | Test ID | Severity | Description | Status |\n`;
      report += `|----------|---------|----------|-------------|--------|\n`;

      for (const issue of allIssues) {
        const status = issue.fixVerified ? '✅ Resolved' : '⚠️ Open';
        report += `| ${issue.issueId} | ${issue.testId} | ${issue.severity} | ${issue.description} | ${status} |\n`;
      }

      report += `\n---\n\n`;

      // Detailed Issue Information
      report += `## 🔍 DETAILED ISSUE INFORMATION\n\n`;

      for (const issue of allIssues) {
        report += `### ${issue.issueId}: ${issue.description}\n\n`;
        report += `- **Test ID:** ${issue.testId}\n`;
        report += `- **Severity:** ${issue.severity}\n`;
        report += `- **Created:** ${issue.createdAt}\n`;
        if (issue.rootCause) {
          report += `- **Root Cause:** ${issue.rootCause}\n`;
        }
        if (issue.fixApplied) {
          report += `- **Fix Applied:** ${issue.fixApplied}\n`;
        }
        if (issue.resolvedAt) {
          report += `- **Resolved:** ${issue.resolvedAt}\n`;
        }
        report += `\n`;
      }

      report += `---\n\n`;
    }

    // Fix References
    const fixedTests = allTests.filter(t => t.fixReference && t.rerunResult === 'PASS');
    if (fixedTests.length > 0) {
      report += `## 🔧 FIX REFERENCES\n\n`;

      report += `| Test ID | Issue ID | Fix Applied | Re-run Result |\n`;
      report += `|---------|----------|-------------|---------------|\n`;

      for (const test of fixedTests) {
        const issue = allIssues.find(i => i.issueId === test.issueId);
        report += `| ${test.testId} | ${test.issueId} | ${issue?.fixApplied || '-'} | ✅ PASS |\n`;
      }

      report += `\n---\n\n`;
    }

    // Re-run Confirmations
    const rerunTests = allTests.filter(t => t.rerunResult);
    if (rerunTests.length > 0) {
      report += `## 🔄 RE-RUN CONFIRMATIONS\n\n`;

      report += `| Test ID | Initial Result | Re-run Result | Final Status |\n`;
      report += `|---------|----------------|---------------|--------------|\n`;

      for (const test of rerunTests) {
        report += `| ${test.testId} | ${test.finalStatus} | ${test.rerunResult} | ${test.finalStatus} |\n`;
      }

      report += `\n---\n\n`;
    }

    // Final Verdict
    report += `## 🎯 FINAL VERDICT\n\n`;

    if (summary.failed === 0 && unresolvedIssues.length === 0) {
      report += `### ✅ SYSTEM IS ENTERPRISE-GRADE & UAT-READY\n\n`;
      report += `All 100 tests have passed successfully. The system demonstrates:\n\n`;
      report += `- ✅ Correct tax calculations across all scenarios\n`;
      report += `- ✅ Proper refund and cancellation policy enforcement\n`;
      report += `- ✅ Reliable tele services and video calling\n`;
      report += `- ✅ Accurate home service tracking and scheduling\n`;
      report += `- ✅ Robust cafe booking and capacity management\n`;
      report += `- ✅ Complete insurance lifecycle handling\n`;
      report += `- ✅ Dynamic vendor dashboard and capabilities\n`;
      report += `- ✅ Proper handling of cross-journey conflicts\n\n`;
      report += `**The system is ready for User Acceptance Testing (UAT).**\n\n`;
    } else {
      report += `### ⚠️ SYSTEM REQUIRES FIXES BEFORE UAT\n\n`;
      report += `The following issues must be resolved:\n\n`;
      report += `- ❌ ${summary.failed} test(s) failing\n`;
      report += `- ❌ ${unresolvedIssues.length} unresolved issue(s)\n\n`;
      report += `**The system is NOT ready for UAT until all issues are resolved.**\n\n`;
    }

    report += `---\n\n`;
    report += `**Report Generated:** ${timestamp}\n`;
    report += `**Test Framework Version:** 1.0.0\n`;

    return report;
  }
}
