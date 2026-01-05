/**
 * ============================================================================
 * REFUND HANDLER WITH IDEMPOTENCY & STATE GUARDS
 * ============================================================================
 *
 * Comprehensive refund handling with:
 * - Idempotency protection
 * - State machine validation
 * - Auto-approval for small amounts
 * - Double-entry ledger integration
 *
 * Date: 2026-01-03
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerRefundEndpoints(app: Hono): void;
//# sourceMappingURL=refunds.d.ts.map