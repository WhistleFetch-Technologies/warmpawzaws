/**
 * ============================================================================
 * PAYMENT ENDPOINTS - ENHANCED VERSION (PHASE 5)
 * ============================================================================
 *
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 *
 * Endpoints:
 * - POST /payments/create - Create payment
 * - POST /payments/razorpay/webhook - Razorpay webhook handler
 * - GET /payments/:id - Get payment details
 *
 * Date: 2026-01-28
 * Phase: 5
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerPaymentEndpointsEnhanced(app: Hono): void;
//# sourceMappingURL=payments-enhanced.d.ts.map