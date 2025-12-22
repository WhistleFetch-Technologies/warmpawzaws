/**
 * ============================================================================
 * COMPLIANCE TEST ENDPOINT
 * ============================================================================
 * 
 * Endpoint to run platform compliance tests
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { PlatformComplianceTestSuite } from "../../lib/tests/platform-compliance-test.ts";
import { runComprehensiveTests } from "../../lib/tests/comprehensive-platform-test.ts";

const BASE_PATH = "/make-server-3dd53475";

export function complianceTestEndpoints(app: Hono) {
  
  /**
   * GET /compliance/test
   * Run all compliance tests
   */
  app.get(`${BASE_PATH}/compliance/test`, async (c) => {
    try {
      const testSuite = new PlatformComplianceTestSuite();
      const results = await testSuite.runAllTests();
      
      const passed = results.filter(r => r.passed).length;
      const total = results.length;
      const percentage = (passed / total * 100).toFixed(2);
      
      return sendSuccess(c, {
        summary: {
          total,
          passed,
          failed: total - passed,
          percentage: parseFloat(percentage)
        },
        results,
        allPassed: passed === total
      }, `Compliance tests completed: ${passed}/${total} passed (${percentage}%)`);
    } catch (error) {
      console.error("❌ [COMPLIANCE] Error running tests:", error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * GET /compliance/test-comprehensive
   * Run comprehensive platform tests
   */
  app.get(`${BASE_PATH}/compliance/test-comprehensive`, async (c) => {
    try {
      console.log('🚀 Running comprehensive platform tests...');
      const testResults = await runComprehensiveTests();
      console.log(`✅ Comprehensive tests completed: ${testResults.passed} passed, ${testResults.failed} failed`);
      
      if (testResults.failed > 0) {
        return sendError(c, {
          message: `${testResults.failed} tests failed`,
          results: testResults.results
        }, 500);
      }
      
      return sendSuccess(c, testResults, 'All comprehensive tests passed.');
    } catch (error) {
      console.error('❌ Error running comprehensive tests:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * GET /compliance/report
   * Generate compliance test report
   */
  app.get(`${BASE_PATH}/compliance/report`, async (c) => {
    try {
      const testSuite = new PlatformComplianceTestSuite();
      const report = await testSuite.generateReport();
      
      return c.text(report, 200, {
        'Content-Type': 'text/markdown',
      });
    } catch (error) {
      console.error("❌ [COMPLIANCE] Error generating report:", error);
      return sendError(c, error, 500);
    }
  });
}

