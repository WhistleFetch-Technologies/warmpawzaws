/**
 * ============================================================================
 * VENDOR BOOKINGS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles vendor booking management:
 * - Get vendor bookings with filters
 * - Update booking status
 * - Booking actions (confirm, cancel, complete)
 *
 * Migrated from: supabase/functions/server/vendor-bookings.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerVendorBookingsEndpoints(app: Hono): void;
//# sourceMappingURL=vendor-bookings.d.ts.map