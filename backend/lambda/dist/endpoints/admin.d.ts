/**
 * ============================================================================
 * ADMIN ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-admin/admin-vendor-routes-sql.tsx
 *
 * Endpoints:
 * - GET /admin/vendors/stats - Get vendor statistics
 * - POST /admin/vendors/:id/approve - Approve vendor
 * - POST /admin/vendors/:id/reject - Reject vendor
 * - GET /admin/vendors - List all vendors
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerAdminEndpoints(app: Hono): void;
//# sourceMappingURL=admin.d.ts.map