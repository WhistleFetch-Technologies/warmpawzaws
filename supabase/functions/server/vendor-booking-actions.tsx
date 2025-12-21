import { Hono } from "npm:hono";

/**
 * VENDOR BOOKING ACTIONS
 * 
 * Endpoints for vendors to take actions on bookings:
 * - Complete booking with OTP verification
 * - Start session (for services like dog walking)
 * - End session
 */

export function vendorBookingActionsEndpoints(app: Hono, kv: any) {
  
  /**
   * Complete a booking with OTP verification
   * POST /make-server-3dd53475/vendor/bookings/:bookingId/complete
   */
  app.post("/make-server-3dd53475/vendor/bookings/:bookingId/complete", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId } = await c.req.json();
      
      console.log(`📋 [COMPLETE-BOOKING] Vendor ${vendorId} completing booking ${bookingId} with OTP: ${otp}`);
      
      // Get booking
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Verify vendor owns this booking
      if (booking.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }
      
      // Check if booking is already completed
      if (booking.status === 'completed') {
        return c.json({ error: 'Booking is already completed' }, 400);
      }
      
      // For tele consultations, no OTP required
      if (!booking.requiresOTP) {
        booking.status = 'completed';
        booking.completedAt = new Date().toISOString();
        booking.updatedAt = new Date().toISOString();
        
        await kv.set(`booking:${bookingId}`, booking);
        
        console.log(`✅ [COMPLETE-BOOKING] Tele consultation completed without OTP`);
        return c.json({ success: true, booking, message: 'Booking completed successfully!' });
      }
      
      // Verify OTP for in-person services
      // Convert both to strings for comparison to handle type mismatch
      const expectedOTP = String(booking.completionOTP).trim();
      const providedOTP = String(otp).trim();
      
      if (expectedOTP !== providedOTP) {
        console.error(`❌ [COMPLETE-BOOKING] Invalid OTP. Expected: "${expectedOTP}" (${typeof booking.completionOTP}), Got: "${providedOTP}" (${typeof otp})`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }
      
      // Mark booking as completed
      booking.status = 'completed';
      booking.otpVerifiedAt = new Date().toISOString();
      booking.completedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [COMPLETE-BOOKING] Booking completed successfully with OTP verification`);
      
      return c.json({ 
        success: true, 
        booking,
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
      
      // Get booking
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Verify vendor owns this booking
      if (booking.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }
      
      // Check if session already started
      if (booking.sessionStartedAt) {
        return c.json({ error: 'Session already started' }, 400);
      }
      
      // Verify OTP
      // Convert both to strings for comparison to handle type mismatch
      const expectedOTP = String(booking.completionOTP).trim();
      const providedOTP = String(otp).trim();
      
      if (expectedOTP !== providedOTP) {
        console.error(`❌ [START-SESSION] Invalid OTP. Expected: "${expectedOTP}" (${typeof booking.completionOTP}), Got: "${providedOTP}" (${typeof otp})`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }
      
      // Start session
      booking.status = 'in_progress';
      booking.sessionStartedAt = new Date().toISOString();
      booking.otpVerifiedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [START-SESSION] Session started successfully`);
      
      return c.json({ 
        success: true, 
        booking,
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
      
      // Get booking
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Verify vendor owns this booking
      if (booking.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }
      
      // Check if session was started
      if (!booking.sessionStartedAt) {
        return c.json({ error: 'Session was not started' }, 400);
      }
      
      // End session and mark as completed
      booking.status = 'completed';
      booking.sessionEndedAt = new Date().toISOString();
      booking.completedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [END-SESSION] Session ended successfully`);
      
      return c.json({ 
        success: true, 
        booking,
        message: 'Session ended and booking completed!' 
      });
      
    } catch (error) {
      console.error('Error ending session:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  console.log('✅ Vendor booking actions endpoints registered');
}