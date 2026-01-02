// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { getBookingsRepository } from '../../../supabase/lib/repositories/index';
import { broadcastVendorUpdate } from './websocket-server';

/**
 * VENDOR BOOKING ACTIONS
 * 
 * Endpoints for vendors to take actions on bookings:
 * - Complete booking with OTP verification
 * - Start session (for services like dog walking)
 * - End session
 */

export function vendorBookingActionsEndpoints(app: Hono) {
  
  /**
   * Complete a booking with OTP verification
   * POST /make-server-3dd53475/vendor/bookings/:bookingId/complete
   */
  app.post("/make-server-3dd53475/vendor/bookings/:bookingId/complete", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId } = await c.req.json();
      
      console.log(`📋 [COMPLETE-BOOKING] Vendor ${vendorId} completing booking ${bookingId} with OTP: ${otp}`);
      
      // ✅ SQL: Get booking from bookings table
      const bookingsRepo = getBookingsRepository();
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
      const requiresOTP = booking.metadata?.requiresOTP !== false;
      if (!requiresOTP) {
        await bookingsRepo.update(bookingId, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        const updatedBooking = await bookingsRepo.findById(bookingId);
        console.log(`✅ [COMPLETE-BOOKING] Tele consultation completed without OTP`);
        return c.json({ success: true, booking: updatedBooking, message: 'Booking completed successfully!' });
      }
      
      // Verify OTP for in-person services
      // Convert both to strings for comparison to handle type mismatch
      const expectedOTP = String(booking.completion_otp || booking.metadata?.completionOTP || '').trim();
      const providedOTP = String(otp).trim();
      
      if (expectedOTP !== providedOTP) {
        console.error(`❌ [COMPLETE-BOOKING] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }
      
      // ✅ SQL: Mark booking as completed
      await bookingsRepo.update(bookingId, {
        status: 'completed',
        otp_verified_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      const updatedBooking = await bookingsRepo.findById(bookingId);
      
      console.log(`✅ [COMPLETE-BOOKING] Booking completed successfully with OTP verification`);
      
      // ✅ BROADCAST: Send real-time update to vendor mobile app
      try {
        broadcastVendorUpdate({
          vendorId,
          updateType: 'booking',
          title: 'Booking Completed',
          message: `Booking ${bookingId} has been completed successfully`,
          bookingId,
          data: { status: 'completed', booking: updatedBooking }
        });
      } catch (wsError) {
        console.error('[COMPLETE-BOOKING] WebSocket broadcast error:', wsError);
        // Don't fail the request if WebSocket fails
      }
      
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
      
      // ✅ SQL: Get booking from bookings table
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }
      
      // Check if session already started
      if (booking.session_started_at || booking.metadata?.sessionStartedAt) {
        return c.json({ error: 'Session already started' }, 400);
      }
      
      // Verify OTP
      const expectedOTP = String(booking.completion_otp || booking.metadata?.completionOTP || '').trim();
      const providedOTP = String(otp).trim();
      
      if (expectedOTP !== providedOTP) {
        console.error(`❌ [START-SESSION] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }
      
      // ✅ SQL: Start session
      await bookingsRepo.update(bookingId, {
        status: 'in_progress',
        session_started_at: new Date().toISOString(),
        otp_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      const updatedBooking = await bookingsRepo.findById(bookingId);
      
      console.log(`✅ [START-SESSION] Session started successfully`);
      
      // ✅ BROADCAST: Send real-time update to vendor mobile app
      try {
        broadcastVendorUpdate({
          vendorId,
          updateType: 'booking',
          title: 'Service Started',
          message: `Service for booking ${bookingId} has started`,
          bookingId,
          data: { status: 'in_progress', booking: updatedBooking }
        });
      } catch (wsError) {
        console.error('[START-SESSION] WebSocket broadcast error:', wsError);
        // Don't fail the request if WebSocket fails
      }
      
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
      
      // ✅ SQL: Get booking from bookings table
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }
      
      // Check if session was started
      if (!booking.session_started_at && !booking.metadata?.sessionStartedAt) {
        return c.json({ error: 'Session was not started' }, 400);
      }
      
      // ✅ SQL: End session and mark as completed
      await bookingsRepo.update(bookingId, {
        status: 'completed',
        session_ended_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
  
  console.log('✅ Vendor booking actions endpoints registered');
}