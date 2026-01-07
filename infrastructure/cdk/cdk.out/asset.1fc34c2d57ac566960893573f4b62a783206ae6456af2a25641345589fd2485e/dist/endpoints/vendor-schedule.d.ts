/**
 * ============================================================================
 * VENDOR SCHEDULE & AVAILABILITY ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles vendor schedule and availability:
 * - Get available slots for a date
 * - Set vendor schedule
 * - Check vacation mode
 * - Generate time slots
 *
 * Migrated from: supabase/functions/make-server-booking/followup-endpoints-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerVendorScheduleEndpoints(app: Hono): void;
//# sourceMappingURL=vendor-schedule.d.ts.map