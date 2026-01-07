/**
 * ============================================================================
 * TRANSACTION MONITORING ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles transaction monitoring and analytics:
 * - Transaction statistics
 * - Transaction listing with filters
 * - Transaction export
 * - Performance metrics
 *
 * Migrated from: supabase/functions/server/transaction-monitoring-endpoints.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerTransactionMonitoringEndpoints(app: Hono): void;
//# sourceMappingURL=transaction-monitoring.d.ts.map