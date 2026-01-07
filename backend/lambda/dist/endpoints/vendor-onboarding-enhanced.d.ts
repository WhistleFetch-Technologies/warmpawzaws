/**
 * ============================================================================
 * VENDOR ONBOARDING ENDPOINTS - ENHANCED VERSION (PHASE 4)
 * ============================================================================
 *
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 * - Fixed database import path
 *
 * Endpoints:
 * - GET /vendor/onboarding/status - Get onboarding status
 * - GET /vendor/onboarding/roles - Get available roles
 * - POST /vendor/onboarding/select-role - Select role
 * - POST /vendor/onboarding/select-vendor-type - Select vendor type
 * - GET /vendor/onboarding/form-schema - Get form schema
 * - POST /vendor/onboarding/submit-application - Submit application
 * - POST /admin/vendor/onboarding/:applicationId/review - Admin review
 * - POST /vendor/onboarding/activate - Activate vendor
 * - POST /vendor/setup/update-completion - Update setup completion
 * - POST /vendor/setup/go-live - Go live
 *
 * Date: 2026-01-28
 * Phase: 4
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerVendorOnboardingEndpointsEnhanced(app: Hono): void;
//# sourceMappingURL=vendor-onboarding-enhanced.d.ts.map