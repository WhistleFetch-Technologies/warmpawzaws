/**
 * ============================================================================
 * BOOKING LIFECYCLE VALIDATION ENDPOINT
 * ============================================================================
 * 
 * Endpoint to validate all services against canonical booking lifecycle
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "jsr:@hono/hono@^4.0.0";
import { sendSuccess, sendError } from "./response-utils.tsx";
import { validateAllServices, generateGapReport } from "../../lib/services/booking-lifecycle-validator.ts";

const app = new Hono();

/**
 * GET /make-server-3dd53475/lifecycle/validate
 * Validate all services against canonical lifecycle
 */
app.get("/make-server-3dd53475/lifecycle/validate", async (c) => {
  try {
    const results = validateAllServices();
    return sendSuccess(c, { 
      validation_results: results,
      timestamp: new Date().toISOString(),
    }, "Lifecycle validation completed");
  } catch (error) {
    console.error("[LifecycleValidation] Error:", error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/lifecycle/gap-report
 * Generate comprehensive gap report
 */
app.get("/make-server-3dd53475/lifecycle/gap-report", async (c) => {
  try {
    const report = generateGapReport();
    return c.text(report, 200, {
      'Content-Type': 'text/markdown',
    });
  } catch (error) {
    console.error("[LifecycleValidation] Error generating report:", error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/lifecycle/validate/:serviceKey
 * Validate specific service
 */
app.get("/make-server-3dd53475/lifecycle/validate/:serviceKey", async (c) => {
  try {
    const { serviceKey } = c.req.param();
    const { validateServiceLifecycle } = await import("../../lib/services/booking-lifecycle-validator.ts");
    const gap = validateServiceLifecycle(serviceKey);
    return sendSuccess(c, { gap }, "Service validation completed");
  } catch (error) {
    console.error("[LifecycleValidation] Error:", error);
    return sendError(c, error, 500);
  }
});

export default app;

