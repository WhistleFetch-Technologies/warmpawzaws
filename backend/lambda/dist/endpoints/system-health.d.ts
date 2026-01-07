/**
 * ============================================================================
 * SYSTEM HEALTH CHECK ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Comprehensive health check for all Warmpawz systems:
 * - Database connectivity
 * - External integrations
 * - Payment gateway
 * - OTP system
 * - Wallet system
 * - Payout system
 *
 * Migrated from: supabase/functions/make-server-3dd53475/system-health-check-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerSystemHealthEndpoints(app: Hono): void;
//# sourceMappingURL=system-health.d.ts.map