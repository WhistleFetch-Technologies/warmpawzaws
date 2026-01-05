/**
 * ============================================================================
 * ROLE CONFIG ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-vendor/vendor-role-config.tsx
 *
 * Endpoints:
 * - GET /config/roles - Get all roles
 * - GET /config/roles/:id - Get role by ID
 * - POST /config/roles - Create role (admin only)
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerRoleEndpoints(app: Hono): void;
//# sourceMappingURL=roles.d.ts.map