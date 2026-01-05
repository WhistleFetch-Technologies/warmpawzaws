/**
 * ============================================================================
 * RAZORPAY PAYMENT & SETTLEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-payment/razorpay-payment-integration-sql.tsx
 *
 * Endpoints:
 * - POST /razorpay/create-order - Create Razorpay order
 * - POST /razorpay/verify-payment - Verify payment
 * - POST /razorpay/webhook - Razorpay webhook handler
 * - POST /razorpay/marketplace/settlement - Marketplace settlement
 * - POST /razorpay/refund - Process refund
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerRazorpayEndpoints(app: Hono): void;
//# sourceMappingURL=razorpay.d.ts.map