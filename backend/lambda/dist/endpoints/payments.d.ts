/**
 * ============================================================================
 * PAYMENT ENDPOINTS - LAMBDA VERSION (TEMPORAL AUDIT COMPLIANT)
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-payment/payment-endpoints.tsx
 *
 * Endpoints:
 * - POST /payments/create - Create payment
 * - POST /payments/razorpay/webhook - Razorpay webhook handler
 * - GET /payments/:id - Get payment details
 *
 * TEMPORAL AUDIT FIXES (2026-01-02):
 * - ✅ Idempotency key enforcement
 * - ✅ Transaction wrapping
 * - ✅ Audit logging
 * - ✅ Event timestamps in SNS messages
 * - ✅ Webhook replay protection
 *
 * Date: 2025-01-28
 * Updated: 2026-01-02 (Temporal Audit Fixes)
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerPaymentEndpoints(app: Hono): void;
//# sourceMappingURL=payments.d.ts.map