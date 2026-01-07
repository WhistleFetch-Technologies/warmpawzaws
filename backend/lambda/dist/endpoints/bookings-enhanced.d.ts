/**
 * ============================================================================
 * BOOKING ENDPOINTS - ENHANCED VERSION (PHASE 3)
 * ============================================================================
 *
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 *
 * Endpoints:
 * - POST /bookings/create - Create new booking
 * - GET /bookings/:id - Get booking details
 * - PUT /bookings/:id/status - Update booking status
 * - GET /bookings/:id/history - Get booking status history
 *
 * Date: 2026-01-28
 * Phase: 3
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerBookingEndpointsEnhanced(app: Hono): void;
//# sourceMappingURL=bookings-enhanced.d.ts.map