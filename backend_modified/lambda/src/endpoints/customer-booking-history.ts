/**
 * ============================================================================
 * CUSTOMER BOOKING HISTORY ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/booking.controller.ts
 * 
 * Handles customer booking history:
 * - Get all bookings for a customer
 * - Get follow-up eligible bookings
 * - Get booking details with vendor/service info
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import {
  getCustomerBookings,
  getBookingDetails,
  getCustomerBookingDetails,
  getFollowUpEligibleBookings
} from '../controllers/booking.controller';

export function registerCustomerBookingHistoryEndpoints(app: Hono) {
  /**
   * GET /customer/:customerId/bookings
   * Get all bookings for a customer
   */
  app.get("/customer/:customerId/bookings", getCustomerBookings);

  /**
   * GET /customer/bookings/:bookingId
   * Get detailed booking information (convenience endpoint)
   */
  app.get("/customer/bookings/:bookingId", getBookingDetails);

  /**
   * GET /customer/:customerId/bookings/:bookingId
   * Get detailed booking information
   */
  app.get("/customer/:customerId/bookings/:bookingId", getCustomerBookingDetails);

  /**
   * GET /customer/:customerId/bookings/follow-up-eligible
   * Get bookings eligible for follow-up (completed within N days from rule engine)
   */
  app.get("/customer/:customerId/bookings/follow-up-eligible", getFollowUpEligibleBookings);
}
