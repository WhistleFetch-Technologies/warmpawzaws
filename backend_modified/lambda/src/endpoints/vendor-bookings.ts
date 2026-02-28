/**
 * ============================================================================
 * VENDOR BOOKINGS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/booking.controller.ts
 * 
 * Handles vendor booking management:
 * - Get vendor bookings with filters
 * - Update booking status
 * - Booking actions (confirm, cancel, complete)
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import {
  getVendorBookings,
  updateVendorBookingStatus,
  confirmVendorBooking,
  cancelVendorBooking,
  declineVendorBooking,
} from '../controllers/booking.controller';

export function registerVendorBookingsEndpoints(app: Hono) {
  /**
   * GET /vendor/bookings/:vendorId
   * Get all bookings for a vendor with filters
   * Requires: booking_view or booking_create capability
   */
  app.get("/vendor/bookings/:vendorId", getVendorBookings);

  /**
   * PUT /vendor/bookings/:bookingId/status
   * Update booking status
   * Requires: booking_create capability
   */
  app.put("/vendor/bookings/:bookingId/status", updateVendorBookingStatus);

  /**
   * POST /vendor/bookings/:bookingId/confirm
   * Confirm a booking
   */
  app.post("/vendor/bookings/:bookingId/confirm", confirmVendorBooking);

  /**
   * POST /vendor/bookings/:bookingId/cancel
   * Cancel a booking
   */
  app.post("/vendor/bookings/:bookingId/cancel", cancelVendorBooking);

  /**
   * POST /vendor/bookings/:bookingId/decline
   * Decline a booking (alias for cancel with reason)
   */
  app.post("/vendor/bookings/:bookingId/decline", declineVendorBooking);

  // NOTE: The following handlers (getVendorBookingDetails, getVendorBookingsAlias, 
  // getVendorBookingsToday) are still inline in this file and will be extracted 
  // to controllers/booking.controller.ts as the migration continues.
  // For now, they remain here to maintain functionality.
  
  // TODO: Extract getVendorBookingDetails, getVendorBookingsAlias, getVendorBookingsToday
  // to controllers/booking.controller.ts
}
