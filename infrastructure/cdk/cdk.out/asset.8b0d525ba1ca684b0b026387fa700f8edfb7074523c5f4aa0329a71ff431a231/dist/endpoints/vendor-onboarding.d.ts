/**
 * ============================================================================
 * VENDOR ONBOARDING ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-vendor/vendor-onboarding.tsx
 *
 * Endpoints:
 * - POST /vendor/apply - Submit vendor application
 * - GET /vendor/onboarding/status - Get onboarding status
 * - PUT /vendor/onboarding/update - Update onboarding progress
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerVendorOnboardingEndpoints(app: Hono): void;
//# sourceMappingURL=vendor-onboarding.d.ts.map