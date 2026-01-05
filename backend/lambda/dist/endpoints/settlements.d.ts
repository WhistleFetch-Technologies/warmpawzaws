/**
 * ============================================================================
 * SETTLEMENTS & PAYOUTS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles vendor settlements and payouts:
 * - Calculate daily settlements
 * - Process payouts
 * - Get settlement history
 * - Vendor bank account management
 *
 * Migrated from: supabase/functions/make-server-payment/settlement-automation.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerSettlementEndpoints(app: Hono): void;
//# sourceMappingURL=settlements.d.ts.map