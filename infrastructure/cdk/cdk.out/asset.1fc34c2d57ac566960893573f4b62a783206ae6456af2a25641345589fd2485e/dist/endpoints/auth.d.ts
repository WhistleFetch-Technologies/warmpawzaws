/**
 * ============================================================================
 * AUTHENTICATION ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-core/auth-endpoints.tsx
 *
 * Endpoints:
 * - POST /auth/send-otp - Send OTP to phone number
 * - POST /auth/verify-otp - Verify OTP and create session
 * - POST /auth/logout - Logout user
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerAuthEndpoints(app: Hono): void;
//# sourceMappingURL=auth.d.ts.map