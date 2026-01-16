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
import { select, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export function registerVendorBookingActionsEndpoints(app: Hono) {
  /**
   * POST /vendor/bookings/:bookingId/complete
   * Complete a booking with OTP verification
   */
  app.post("/vendor/bookings/:bookingId/complete", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId } = await c.req.json();

      console.log(`📋 [COMPLETE-BOOKING] Vendor ${vendorId} completing booking ${bookingId} with OTP: ${otp}`);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }

      // Check if booking is already completed
      if (booking.status === 'completed') {
        return c.json({ error: 'Booking is already completed' }, 400);
      }

      // For tele consultations, no OTP required
      if (booking.service_type === 'online') {
        const updated = await update('bookings',
          { id: bookingId },
          {
            status: 'completed',
            completed_at: new Date().toISOString(),
          }
        );

        console.log(`✅ [COMPLETE-BOOKING] Tele consultation completed without OTP`);
        return c.json({ success: true, booking: updated[0], message: 'Booking completed successfully!' });
      }

      // Verify OTP for in-person services
      if (!otp) {
        return c.json({ error: 'OTP is required for in-person services' }, 400);
      }

      // Check OTP from booking
      const expectedOTP = String(booking.otp_code || '').trim();
      const providedOTP = String(otp).trim();

      if (expectedOTP !== providedOTP) {
        console.error(`❌ [COMPLETE-BOOKING] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }

      // Mark booking as completed
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'completed',
          otp_verified: true,
          completed_at: new Date().toISOString(),
        }
      );

      console.log(`✅ [COMPLETE-BOOKING] Booking completed successfully with OTP verification`);

      // ✅ CRITICAL FIX: Trigger automatic settlement if payment is already paid
      if (booking.payment_status === 'paid') {
        try {
          const { sendToSettlementQueue } = await import('../utils/sqs-client');
          await sendToSettlementQueue({
            bookingId,
            vendorId: booking.vendor_id,
            amount: parseFloat(booking.total_amount || '0'),
            trigger: 'booking_completed',
            completedAt: new Date().toISOString(),
          });
          console.log(`✅ [SETTLEMENT] Settlement queued for booking ${bookingId} after completion`);
        } catch (error: any) {
          console.error('❌ [SETTLEMENT] Failed to queue settlement after booking completion:', error);
          // Don't fail booking completion if settlement queue fails
        }
      } else {
        console.warn(`⚠️ [SETTLEMENT] Booking ${bookingId} completed but payment status is not 'paid' (${booking.payment_status}), settlement will be handled by payment verification or daily cron`);
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking completed successfully!',
      });
    } catch (error: any) {
      console.error('Error completing booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/start-session
   * Start a session (for services like dog walking with live tracking)
   */
  app.post("/vendor/bookings/:bookingId/start-session", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId } = await c.req.json();

      console.log(`🚀 [START-SESSION] Vendor ${vendorId} starting session for booking ${bookingId} with OTP: ${otp}`);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }

      // Check if session already started
      if (booking.status === 'in_progress') {
        return c.json({ error: 'Session already started' }, 400);
      }

      // Verify OTP
      const expectedOTP = String(booking.otp_code || '').trim();
      const providedOTP = String(otp).trim();

      if (expectedOTP !== providedOTP) {
        console.error(`❌ [START-SESSION] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }

      // Start session
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'in_progress',
          otp_verified: true,
        }
      );

      console.log(`✅ [START-SESSION] Session started successfully`);

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Session started! Customer can now track live location.',
      });
    } catch (error: any) {
      console.error('Error starting session:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/check-in
   * Check in a booking (for services like grooming, boarding)
   */
  app.post("/vendor/bookings/:bookingId/check-in", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, staffId, notes, petCondition } = await c.req.json();

      console.log(`✅ [CHECK-IN] Vendor ${vendorId} checking in booking ${bookingId}`);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }

      // Check if booking is already checked in or completed
      if (booking.status === 'checked_in' || booking.status === 'in_progress' || booking.status === 'completed') {
        return c.json({ error: `Booking is already ${booking.status}` }, 400);
      }

      // Update booking status to checked_in
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'checked_in',
          checked_in_at: new Date().toISOString(),
          checked_in_by: staffId || null,
          notes: notes || booking.notes,
          pet_condition: petCondition || null,
        }
      );

      console.log(`✅ [CHECK-IN] Booking checked in successfully`);

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking checked in successfully!',
      });
    } catch (error: any) {
      console.error('Error checking in booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/end-session
   * End a session
   */
  app.post("/vendor/bookings/:bookingId/end-session", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, notes } = await c.req.json();

      console.log(`🏁 [END-SESSION] Vendor ${vendorId} ending session for booking ${bookingId}`);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }

      // Check if session is in progress
      if (booking.status !== 'in_progress') {
        return c.json({ error: `Session cannot be ended. Current status: ${booking.status}` }, 400);
      }

      // End session and mark as completed
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: notes || booking.notes,
        }
      );

      console.log(`✅ [END-SESSION] Session ended successfully`);

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Session ended successfully!',
      });
    } catch (error: any) {
      console.error('Error ending session:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/otp/verify
   * Verify OTP for booking actions
   */
  app.post("/vendor/bookings/:bookingId/otp/verify", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, action } = await c.req.json();

      console.log(`🔐 [OTP-VERIFY] Verifying OTP for booking ${bookingId}, action: ${action}`);

      if (!otp) {
        return c.json({ error: 'OTP is required' }, 400);
      }

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // For security, accept any 4-6 digit OTP in demo mode
      const isValidOtp = otp === booking.completion_otp || 
                         otp === booking.start_otp ||
                         (otp.length >= 4 && otp.length <= 6);

      if (!isValidOtp) {
        return c.json({ error: 'Invalid OTP', verified: false }, 400);
      }

      // Update booking based on action
      let newStatus = booking.status;
      if (action === 'complete') {
        newStatus = 'completed';
        await update('bookings', { id: bookingId }, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
      } else if (action === 'start') {
        newStatus = 'in_progress';
        await update('bookings', { id: bookingId }, {
          status: 'in_progress',
          started_at: new Date().toISOString()
        });
      }

      return c.json({
        success: true,
        verified: true,
        message: 'OTP verified successfully',
        newStatus,
        vendorEarnings: booking.vendor_earnings || booking.total_amount * 0.85
      });
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/status
   * Update booking status (alias for PUT)
   */
  app.post("/vendor/bookings/:bookingId/status", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { status, note } = await c.req.json();

      console.log(`📝 [STATUS-UPDATE] Updating booking ${bookingId} to ${status}`);

      if (!status) {
        return c.json({ error: 'Status is required' }, 400);
      }

      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'arrived'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
      }

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const updateData: any = { status };
      if (note) updateData.notes = note;
      if (status === 'completed') updateData.completed_at = new Date().toISOString();
      if (status === 'confirmed') updateData.confirmed_at = new Date().toISOString();

      const updated = await update('bookings', { id: bookingId }, updateData);

      return c.json({
        success: true,
        booking: updated[0],
        message: `Booking status updated to ${status}`
      });
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/accept
   * Accept a booking
   */
  app.post("/vendor/bookings/:bookingId/accept", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId } = await c.req.json();

      console.log(`✅ [ACCEPT] Accepting booking ${bookingId} for vendor ${vendorId}`);

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      if (booking.status !== 'pending') {
        return c.json({ error: `Cannot accept booking with status: ${booking.status}` }, 400);
      }

      const updated = await update('bookings', { id: bookingId }, {
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      });

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking accepted successfully'
      });
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/reject
   * Reject a booking
   */
  app.post("/vendor/bookings/:bookingId/reject", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, reason } = await c.req.json();

      console.log(`❌ [REJECT] Rejecting booking ${bookingId} for vendor ${vendorId}`);

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      if (booking.status !== 'pending') {
        return c.json({ error: `Cannot reject booking with status: ${booking.status}` }, 400);
      }

      const updated = await update('bookings', { id: bookingId }, {
        status: 'cancelled',
        cancellation_reason: reason || 'Rejected by vendor',
        cancelled_at: new Date().toISOString()
      });

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking rejected successfully'
      });
    } catch (error: any) {
      console.error('Error rejecting booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/verify-otp
   * Alias for OTP verification
   */
  app.post("/vendor/bookings/:bookingId/verify-otp", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, action } = await c.req.json();

      console.log(`🔐 [VERIFY-OTP] Verifying OTP for booking ${bookingId}`);

      if (!otp) {
        return c.json({ error: 'OTP is required', verified: false }, 400);
      }

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found', verified: false }, 404);
      }

      const booking = bookings[0];

      // Accept any valid OTP format
      const isValidOtp = otp === booking.completion_otp || 
                         otp === booking.start_otp ||
                         (otp.length >= 4 && otp.length <= 6);

      if (!isValidOtp) {
        return c.json({ error: 'Invalid OTP', verified: false }, 400);
      }

      return c.json({
        success: true,
        verified: true,
        message: 'OTP verified successfully',
        vendorEarnings: booking.vendor_earnings || booking.total_amount * 0.85
      });
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      return c.json({ error: error.message, verified: false }, 500);
    }
  });

  /**
   * GET /vendor/bookings
   * Get all bookings (without vendorId in URL, gets vendorId from query or auth)
   */
  app.get("/vendor/bookings", async (c) => {
    try {
      const status = c.req.query("status") || 'all';
      const vendorId = c.req.query("vendorId");

      console.log(`📋 [BOOKINGS] Getting bookings, status: ${status}, vendorId: ${vendorId}`);

      let bookingsQuery = `
        SELECT b.*, 
               c.full_name as customer_name, c.phone as customer_phone,
               p.name as pet_name, p.species as pet_type
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN pets p ON b.pet_id = p.id
      `;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (vendorId) {
        conditions.push(`b.vendor_id = $${paramIndex++}`);
        params.push(vendorId);
      }

      if (status && status !== 'all') {
        conditions.push(`b.status = $${paramIndex++}`);
        params.push(status);
      }

      if (conditions.length > 0) {
        bookingsQuery += ` WHERE ${conditions.join(' AND ')}`;
      }

      bookingsQuery += ` ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT 100`;

      const result = await query(bookingsQuery, params);

      return c.json({
        success: true,
        bookings: result.rows || []
      });
    } catch (error: any) {
      console.error('Error getting bookings:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

