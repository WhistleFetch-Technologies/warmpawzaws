/**
 * ============================================================================
 * REFUND POLICY ENGINE - LAMBDA VERSION
 * ============================================================================
 *
 * Handles refund policy rules and calculations:
 * - Calculate refund eligibility based on booking time
 * - Apply refund rules (time-based, amount-based, status-based)
 * - Get refund percentage and amount
 * - Manage refund rules (admin)
 *
 * Date: 2026-01-27
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerRefundPolicyEngineEndpoints(app: Hono): void;
//# sourceMappingURL=refund-policy-engine.d.ts.map