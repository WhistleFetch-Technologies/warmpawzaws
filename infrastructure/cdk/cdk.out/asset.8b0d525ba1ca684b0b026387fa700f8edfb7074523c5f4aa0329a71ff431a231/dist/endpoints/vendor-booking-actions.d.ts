/**
 * ============================================================================
 * VENDOR BOOKING ACTIONS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Endpoints for vendors to take actions on bookings:
 * - Complete booking with OTP verification
 * - Start session (for services like dog walking)
 * - End session
 *
 * Migrated from: supabase/functions/server/vendor-booking-actions.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerVendorBookingActionsEndpoints(app: Hono): void;
//# sourceMappingURL=vendor-booking-actions.d.ts.map