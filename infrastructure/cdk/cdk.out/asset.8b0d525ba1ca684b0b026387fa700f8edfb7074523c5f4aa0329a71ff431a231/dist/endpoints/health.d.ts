/**
 * ============================================================================
 * HEALTH CHECK ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * System health monitoring:
 * - Database connectivity
 * - External service status
 * - System metrics
 *
 * Migrated from: supabase/functions/server/system-health-check.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerHealthEndpoints(app: Hono): void;
//# sourceMappingURL=health.d.ts.map