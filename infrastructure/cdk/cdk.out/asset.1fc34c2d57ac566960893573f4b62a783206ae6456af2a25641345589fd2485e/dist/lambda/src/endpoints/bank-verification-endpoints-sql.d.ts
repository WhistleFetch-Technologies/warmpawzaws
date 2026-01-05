/**
 * ============================================================================
 * BANK ACCOUNT VERIFICATION ENDPOINTS - SQL VERSION
 * ============================================================================
 *
 * Complete bank account verification & payout management
 *
 * MIGRATED: All KV operations replaced with SQL repositories
 *
 * Features:
 * - Bank account verification (penny drop via Razorpay)
 * - IFSC code validation
 * - Account holder name verification
 * - Multiple account support
 * - Primary account management
 * - Payout beneficiary management
 * - Settlement configuration
 * - Verification status tracking
 *
 * Date: 2025-01-27
 * Migration: Phase 6 - KV to SQL
 * ============================================================================
 */
import { Hono } from "hono";
export declare function bankVerificationEndpoints(app: Hono): void;
//# sourceMappingURL=bank-verification-endpoints-sql.d.ts.map