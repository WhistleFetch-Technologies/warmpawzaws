/**
 * ============================================================================
 * RETURNS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles return requests and refunds:
 * - Check return eligibility
 * - Create return requests
 * - Approve/reject returns
 * - Process refunds
 *
 * Migrated from: supabase/functions/make-server-3dd53475/returns-management-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerReturnsEndpoints(app: Hono): void;
//# sourceMappingURL=returns.d.ts.map