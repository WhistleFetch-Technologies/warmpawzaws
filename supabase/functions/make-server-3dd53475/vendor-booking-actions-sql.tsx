/**
 * VENDOR BOOKING ACTIONS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Endpoints for vendors to take actions on bookings:
 * - Complete booking with OTP verification
 * - Start session (for services like dog walking)
 * - End session
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (7 KV operations → 0)
 * Endpoints: 3
 */

import { Hono } from "npm:hono";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getOtpRepository } from "../../lib/repositories/otp.ts";
import { withTransaction } from "../../lib/db.ts";

export function vendorBookingActionsEndpointsSQL(app: Hono) {
  const bookingsRepo = getBookingsRepository();
  const otpRepo = getOtpRepository();
  
  /**
   * Complete a booking with OTP verification
   * POST /make-server-3dd53475/vendor/bookings/:bookingId/complete
   */
  app.post("/make-server-3dd53475/vendor/bookings/:bookingId/complete", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId } = await c.req.json();
      
      console.log(`📋 [COMPLETE-BOOKING] Vendor ${vendorId} completing booking ${bookingId} with OTP: ${otp}`);
      
      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }
      
      // Check if booking is already completed
      if (booking.status === 'completed') {
        return c.json({ error: 'Booking is already completed' }, 400);
      }
      
      // For tele consultations, no OTP required
      const requiresOTP = (booking.metadata as any)?.requires_otp !== false;
      
      if (!requiresOTP) {
        // ✅ SQL: Update booking status
        await withTransaction(async () => {
          await bookingsRepo.update(bookingId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        });
        
        const updatedBooking = await bookingsRepo.findById(bookingId);
        
        console.log(`✅ [COMPLETE-BOOKING] Tele consultation completed without OTP`);
        return c.json({ success: true, booking: updatedBooking, message: 'Booking completed successfully!' });
      }
      
      // ✅ SQL: Verify OTP for in-person services
      const bookingOTP = (booking.metadata as any)?.completion_otp;
      if (!bookingOTP) {
        return c.json({ error: 'OTP not found for this booking' }, 400);
      }
      
      // Convert both to strings for comparison to handle type mismatch
      const expectedOTP = String(bookingOTP).trim();
      const providedOTP = String(otp).trim();
      
      if (expectedOTP !== providedOTP) {
        console.error(`❌ [COMPLETE-BOOKING] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }
      
      // ✅ SQL: Mark booking as completed with transaction
      await withTransaction(async () => {
        const metadata = (booking.metadata as any) || {};
        metadata.otp_verified_at = new Date().toISOString();
        
        await bookingsRepo.update(bookingId, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: metadata
        });
      });
      
      const updatedBooking = await bookingsRepo.findById(bookingId);
      
      console.log(`✅ [COMPLETE-BOOKING] Booking completed successfully with OTP verification`);
      
      return c.json({ 
        success: true, 
        booking: updatedBooking,
        message: 'Booking completed successfully!' 
      });
      
    } catch (error) {
      console.error('Error completing booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Start a session (for services like dog walking with live tracking)
   * POST /make-server-3dd53475/vendor/bookings/:bookingId/start-session
   */
  app.post("/make-server-3dd53475/vendor/bookings/:bookingId/start-session", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId } = await c.req.json();
      
      console.log(`🚀 [START-SESSION] Vendor ${vendorId} starting session for booking ${bookingId} with OTP: ${otp}`);
      
      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }
      
      // Check if session already started
      const metadata = (booking.metadata as any) || {};
      if (metadata.session_started_at) {
        return c.json({ error: 'Session already started' }, 400);
      }
      
      // ✅ SQL: Verify OTP
      const bookingOTP = metadata.completion_otp;
      if (!bookingOTP) {
        return c.json({ error: 'OTP not found for this booking' }, 400);
      }
      
      // Convert both to strings for comparison to handle type mismatch
      const expectedOTP = String(bookingOTP).trim();
      const providedOTP = String(otp).trim();
      
      if (expectedOTP !== providedOTP) {
        console.error(`❌ [START-SESSION] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }
      
      // ✅ SQL: Start session with transaction
      await withTransaction(async () => {
        metadata.session_started_at = new Date().toISOString();
        metadata.otp_verified_at = new Date().toISOString();
        
        await bookingsRepo.update(bookingId, {
          status: 'in_progress',
          updated_at: new Date().toISOString(),
          metadata: metadata
        });
      });
      
      const updatedBooking = await bookingsRepo.findById(bookingId);
      
      console.log(`✅ [START-SESSION] Session started successfully`);
      
      return c.json({ 
        success: true, 
        booking: updatedBooking,
        message: 'Session started! Customer can now track live location.' 
      });
      
    } catch (error) {
      console.error('Error starting session:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * End a session
   * POST /make-server-3dd53475/vendor/bookings/:bookingId/end-session
   */
  app.post("/make-server-3dd53475/vendor/bookings/:bookingId/end-session", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId } = await c.req.json();
      
      console.log(`🏁 [END-SESSION] Vendor ${vendorId} ending session for booking ${bookingId}`);
      
      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }
      
      // Check if session was started
      const metadata = (booking.metadata as any) || {};
      if (!metadata.session_started_at) {
        return c.json({ error: 'Session was not started' }, 400);
      }
      
      // ✅ SQL: End session and mark as completed with transaction
      await withTransaction(async () => {
        metadata.session_ended_at = new Date().toISOString();
        
        await bookingsRepo.update(bookingId, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: metadata
        });
      });
      
      const updatedBooking = await bookingsRepo.findById(bookingId);
      
      console.log(`✅ [END-SESSION] Session ended successfully`);
      
      return c.json({ 
        success: true, 
        booking: updatedBooking,
        message: 'Session ended and booking completed!' 
      });
      
    } catch (error) {
      console.error('Error ending session:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  console.log('✅ Vendor booking actions endpoints registered (SQL-only)');
}

