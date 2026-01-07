/**
 * ============================================================================
 * VENDOR ONBOARDING & APPLICATION MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Handles vendor application submission, approval, rejection, and service setup
 *
 * ✅ CRITICAL FIXES:
 * 1. Duplicate phone number validation
 * 2. Proper service category mapping
 * 3. Business name priority in display
 * 4. Document handling
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function vendorOnboardingEndpoints(app: Hono): void;
//# sourceMappingURL=vendor-onboarding-sql.d.ts.map