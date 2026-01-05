/**
 * ============================================================================
 * REWARDS & LOYALTY SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Loyalty points earning and redemption
 * - Wallet credit from loyalty redemption
 * - Referral code management
 * - Loyalty rules management
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2025-01-27
 * Migration: Phase 6 - KV to SQL (Critical P0)
 * ============================================================================
 */
import { Hono } from "hono";
export declare function rewardsLoyaltySystemSQL(mainApp: Hono): void;
export default rewardsLoyaltySystemSQL;
//# sourceMappingURL=rewards-loyalty-system-sql.d.ts.map