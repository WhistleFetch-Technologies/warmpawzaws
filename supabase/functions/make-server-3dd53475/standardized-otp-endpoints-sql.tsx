/**
 * ============================================================================
 * STANDARDIZED OTP ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Generate OTP for booking session start/end
 * - Verify OTP and manage session lifecycle
 * - OTP attempt tracking
 * - Session state management
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `bookings` table for booking data
 * - Uses `otp_tokens` table for OTP storage
 * - Uses `BookingsRepository` and `OtpRepository`
 * 
 * Date: 2025-01-28
 * Migration: Batch 13 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getOtpRepository } from '../../lib/repositories/otp.ts';

const app = new Hono();
app.use('*', cors());

/**
 * POST /bookings/:bookingId/generate-otp
 * Generate OTP for session start/end
 */
app.post('/make-server-3dd53475/bookings/:bookingId/generate-otp', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { sessionNumber = 1, action = 'start' } = await c.req.json();

    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // ✅ SQL: Store OTP in otp_tokens table
    const otpRepo = getOtpRepository();
    const otpToken = await otpRepo.create({
      phone: '', // Will be populated from booking customer
      code: otp,
      purpose: `booking_${action}_session_${sessionNumber}`,
      expires_at: expiresAt.toISOString()
    });

    // ✅ SQL: Update booking with OTP code
    if (action === 'start') {
      await bookingsRepo.update(bookingId, {
        otp_start_code: otp,
        otp_start_verified: false,
        otp_start_attempts: 0
      });
    } else if (action === 'end') {
      await bookingsRepo.update(bookingId, {
        otp_end_code: otp,
        otp_end_verified: false,
        otp_end_attempts: 0
      });
    }

    // ✅ SQL: Get customer for sending OTP
    const db = getDbClient();
    const { data: customer } = await db
      .from('customers')
      .select('phone, email')
      .eq('id', booking.customer_id)
      .single();

    // Send OTP (would integrate with SMS/push notification service)
    const sentTo = customer?.phone || customer?.email || 'unknown';

    console.log(`✅ Generated OTP for booking ${bookingId}, session ${sessionNumber}, action ${action}: ${otp}`);

    return c.json({
      success: true,
      otp, // In production, don't return OTP - only for testing
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      sentTo
    });

  } catch (error: any) {
    console.error('Error generating OTP:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /bookings/:bookingId/verify-otp
 * Verify OTP and start/end session
 */
app.post('/make-server-3dd53475/bookings/:bookingId/verify-otp', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { otp, action = 'start', sessionNumber = 1 } = await c.req.json();

    if (!otp || otp.length !== 6) {
      return c.json({ error: 'Invalid OTP format' }, 400);
    }

    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Get stored OTP from booking
    const storedOtp = action === 'start' ? booking.otp_start_code : booking.otp_end_code;
    const attempts = action === 'start' ? (booking.otp_start_attempts || 0) : (booking.otp_end_attempts || 0);
    const isVerified = action === 'start' ? booking.otp_start_verified : booking.otp_end_verified;

    if (!storedOtp) {
      return c.json({ 
        error: 'OTP not found',
        message: 'Please generate a new OTP'
      }, 400);
    }

    // Check if already verified
    if (isVerified) {
      return c.json({ 
        error: 'OTP already verified',
        message: 'Session already started/ended'
      }, 400);
    }

    // Check attempts
    if (attempts >= 3) {
      return c.json({ 
        error: 'Maximum attempts exceeded',
        message: 'Please generate a new OTP'
      }, 400);
    }

    // Verify OTP
    if (otp !== storedOtp) {
      // ✅ SQL: Increment attempts
      if (action === 'start') {
        await bookingsRepo.update(bookingId, {
          otp_start_attempts: attempts + 1
        });
      } else {
        await bookingsRepo.update(bookingId, {
          otp_end_attempts: attempts + 1
        });
      }

      return c.json({
        success: false,
        verified: false,
        message: 'Invalid OTP',
        remainingAttempts: 3 - (attempts + 1)
      }, 400);
    }

    // OTP verified successfully
    const now = new Date().toISOString();
    
    // ✅ SQL: Update booking with verified status
    if (action === 'start') {
      await bookingsRepo.update(bookingId, {
        otp_start_verified: true,
        started_at: now,
        status: 'in_progress'
      });
    } else if (action === 'end') {
      await bookingsRepo.update(bookingId, {
        otp_end_verified: true,
        status: 'completed',
        completed_at: now
      });
    }

    console.log(`✅ OTP verified for booking ${bookingId}, action: ${action}`);

    return c.json({
      success: true,
      verified: true,
      message: action === 'start' ? 'Session started successfully' : 'Session ended successfully',
      booking: {
        id: booking.id,
        status: action === 'start' ? 'in_progress' : 'completed',
        startedAt: action === 'start' ? now : booking.started_at,
        completedAt: action === 'end' ? now : booking.completed_at
      }
    });

  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;

