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

