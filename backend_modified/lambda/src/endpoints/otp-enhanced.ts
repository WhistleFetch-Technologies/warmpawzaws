/**
 * ============================================================================
 * ENHANCED OTP ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/auth.controller.ts
 * 
 * Universal OTP system for booking verification:
 * - Generate OTP for booking sessions
 * - Verify OTP to start/end sessions
 * - Booking OTP management
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { 
  generateBookingOtp,
  verifyBookingOtp,
  createBookingWithOtp
} from '../controllers/auth.controller';

export function registerEnhancedOtpEndpoints(app: Hono) {
  /**
   * POST /bookings/:bookingId/generate-otp
   * Generate OTP for booking session start/end
   */
  app.post("/bookings/:bookingId/generate-otp", generateBookingOtp);

  /**
   * POST /bookings/:bookingId/verify-otp
   * Verify OTP and start/end session
   */
  app.post("/bookings/:bookingId/verify-otp", verifyBookingOtp);

  /**
   * POST /bookings/create-with-otp
   * Create booking with OTP system
   */
  app.post("/bookings/create-with-otp", createBookingWithOtp);
}
