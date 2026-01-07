/**
 * ============================================================================
 * BOOKING ENDPOINTS - LAMBDA VERSION (TEMPORAL AUDIT COMPLIANT)
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-booking/booking-endpoints.tsx
 *
 * Endpoints:
 * - POST /bookings/create - Create new booking
 * - GET /bookings/:id - Get booking details
 * - PUT /bookings/:id/status - Update booking status
 * - GET /bookings/:id/history - Get booking status history
 *
 * TEMPORAL AUDIT FIXES (2026-01-02):
 * - ✅ Idempotency key enforcement
 * - ✅ Booking date/time validation
 * - ✅ Transaction wrapping
 * - ✅ Audit logging
 * - ✅ Event timestamps in SNS messages
 *
 * Date: 2025-01-28
 * Updated: 2026-01-02 (Temporal Audit Fixes)
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerBookingEndpoints(app: Hono): void;
//# sourceMappingURL=bookings.d.ts.map