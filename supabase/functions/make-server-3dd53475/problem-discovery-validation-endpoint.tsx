/**
 * ============================================================================
 * PROBLEM DISCOVERY VALIDATION ENDPOINT
 * ============================================================================
 * 
 * Endpoint to validate problem-driven discovery flow
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getProblemDiscoveryValidator } from "../../lib/services/problem-discovery-validator.ts";

const BASE_PATH = "/make-server-3dd53475";

export function problemDiscoveryValidationEndpoints(app: Hono) {
  /**
   * GET /problem-discovery/validate
   * Validate problem-driven discovery flow
   */
  app.get(`${BASE_PATH}/problem-discovery/validate`, async (c) => {
    try {
      const validator = getProblemDiscoveryValidator();
      const report = await validator.validateAll();
      
      return sendSuccess(c, report, 'Problem discovery validation completed');
    } catch (error) {
      console.error("❌ [PROBLEM-DISCOVERY] Error validating:", error);
      return sendError(c, error, 500);
    }
  });
}

