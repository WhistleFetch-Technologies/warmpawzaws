/**
 * ============================================================================
 * SERVICE LIFECYCLE VALIDATION ENDPOINT
 * ============================================================================
 * 
 * Endpoint to validate all services against canonical booking lifecycle
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getServiceLifecycleValidator, generateServiceLifecycleGapReport } from "../../lib/services/service-lifecycle-validator.ts";

const BASE_PATH = "/make-server-3dd53475";

export function serviceLifecycleValidationEndpoints(app: Hono) {
  /**
   * GET /service-lifecycle/validate
   * Validate all services against canonical lifecycle
   */
  app.get(`${BASE_PATH}/service-lifecycle/validate`, async (c) => {
    try {
      const validator = getServiceLifecycleValidator();
      const report = await validator.validateAll();
      
      return sendSuccess(c, report, 'Service lifecycle validation completed');
    } catch (error) {
      console.error("❌ [SERVICE-LIFECYCLE] Error validating:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /service-lifecycle/gap-report
   * Generate gap report as markdown
   */
  app.get(`${BASE_PATH}/service-lifecycle/gap-report`, async (c) => {
    try {
      const report = await generateServiceLifecycleGapReport();
      
      return c.text(report, 200, {
        'Content-Type': 'text/markdown',
      });
    } catch (error) {
      console.error("❌ [SERVICE-LIFECYCLE] Error generating gap report:", error);
      return sendError(c, error, 500);
    }
  });
}

