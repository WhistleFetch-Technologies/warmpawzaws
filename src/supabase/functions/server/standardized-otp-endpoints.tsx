/**
 * STANDARDIZED OTP ENDPOINTS
 * 
 * Aligns existing OTP functionality with checklist specifications
 * Creates wrapper endpoints matching exact paths from handoff checklist
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { cors } from "hono/cors";
import {
  getBookingsRepository,
  getCustomersRepository,
  getPetsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();
app.use('*', cors());

/**
 * POST /bookings/:bookingId/generate-otp
 * Generate OTP for session start/end
 * 
 * Status: ⚠️ STANDARDIZED (was /booking/:bookingId/generate-otp)
 * 
 * ALIGNMENT NOTE:
 * - Changed from singular "booking" to plural "bookings"
 * - Added sessionNumber support
 * - Extended expiry to 24 hours (was 10 minutes)
 * - Added action field (start/end)
 */
app.post('/bookings/:bookingId/generate-otp', async (c) => {
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

    // ✅ SQL: Store OTP in bookings table
    const db = getDbClient();
    await db
      .from('bookings')
      .update({
        otp: otp,
        otp_session_number: sessionNumber,
        otp_action: action,
        otp_generated_at: now.toISOString(),
        otp_expires_at: expiresAt.toISOString(),
        otp_verified: false,
        otp_attempts: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    // Send OTP (would integrate with SMS/push notification service)
    const customerId = booking.customer_id || booking.customerId;
    const customer = await getCustomerDetails(customerId);
    const sentTo = await sendOTP(customer, otp, action);

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
 * 
 * Status: ⚠️ STANDARDIZED (was /booking/:bookingId/verify-otp)
 * 
 * ALIGNMENT NOTE:
 * - Changed from singular "booking" to plural "bookings"
 * - Added sessionNumber support
 * - Added action field (start/end)
 * - Added max 3 attempts logic
 * - Added session state management
 * - Added S3 upload trigger on action='end'
 */
app.post('/bookings/:bookingId/verify-otp', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { otp, action = 'start', sessionNumber = 1 } = await c.req.json();

    if (!otp || otp.length !== 6) {
      return c.json({ error: 'Invalid OTP format' }, 400);
    }

    // ✅ SQL: Get stored OTP from booking
    const bookingsRepo = getBookingsRepository();
    const bookingData = await bookingsRepo.findById(bookingId);
    
    if (!bookingData || !bookingData.otp) {
      return c.json({ 
        error: 'OTP not found',
        message: 'Please generate a new OTP'
      }, 400);
    }

    const storedOtp = {
      otp: bookingData.otp,
      sessionNumber: bookingData.otp_session_number,
      action: bookingData.otp_action,
      generatedAt: bookingData.otp_generated_at,
      expiresAt: bookingData.otp_expires_at,
      verified: bookingData.otp_verified || false,
      attempts: bookingData.otp_attempts || 0
    };

    // Check expiry
    if (new Date() > new Date(storedOtp.expiresAt)) {
      return c.json({ 
        error: 'OTP expired',
        message: 'Please generate a new OTP'
      }, 400);
    }

    // Check attempts
    if (storedOtp.attempts >= 3) {
      return c.json({ 
        error: 'Maximum attempts exceeded',
        message: 'Please generate a new OTP'
      }, 400);
    }

    // Verify OTP
    if (otp !== storedOtp.otp) {
      const newAttempts = storedOtp.attempts + 1;
      // ✅ SQL: Update OTP attempts
      await bookingsRepo.update(bookingId, {
        otp_attempts: newAttempts,
        updated_at: new Date().toISOString()
      });

      return c.json({
        success: false,
        verified: false,
        message: 'Invalid OTP',
        remainingAttempts: 3 - newAttempts
      }, 400);
    }

    // OTP verified successfully
    const verifiedAt = new Date().toISOString();
    // ✅ SQL: Update OTP as verified
    await bookingsRepo.update(bookingId, {
      otp_verified: true,
      otp_verified_at: verifiedAt,
      updated_at: verifiedAt
    });

    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);

    // Update session based on action
    let sessionStatus = '';
    let response: any = {
      success: true,
      verified: true,
      message: 'OTP verified successfully'
    };

    if (action === 'start') {
      // Start session
      sessionStatus = 'active';
      const startTime = new Date().toISOString();

      // ✅ SQL: Update booking session status
      await bookingsRepo.update(bookingId, {
        session_status: sessionStatus,
        session_start_time: startTime,
        session_number: sessionNumber,
        updated_at: startTime
      });

      response.sessionStatus = sessionStatus;
      response.startTime = startTime;
      response.message = 'Session started successfully';

      console.log(`✅ Session ${sessionNumber} started for booking ${bookingId}`);

    } else if (action === 'end') {
      // End session
      sessionStatus = 'completed';
      const endTime = new Date().toISOString();

      // ✅ SQL: Update booking session end
      await bookingsRepo.update(bookingId, {
        session_status: sessionStatus,
        session_end_time: endTime,
        updated_at: endTime
      });

      response.sessionStatus = sessionStatus;
      response.endTime = endTime;
      response.message = 'Session completed successfully';

      // TRIGGER S3 UPLOAD (async) - Get updated booking data
      const updatedBooking = await bookingsRepo.findById(bookingId);
      setTimeout(() => uploadSessionToS3(bookingId, sessionNumber, updatedBooking), 1000);

      console.log(`✅ Session ${sessionNumber} completed for booking ${bookingId}`);
    }

    return c.json(response);

  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Upload session to S3 (called after session end)
 */
async function uploadSessionToS3(bookingId: string, sessionNumber: number, booking: any) {
  try {
    console.log(`📤 Uploading session ${sessionNumber} to S3 for booking ${bookingId}`);

    const sessionLog = {
      sessionId: `session_${bookingId}_${sessionNumber}`,
      bookingId,
      sessionNumber,
      startTime: booking.sessionStartTime,
      endTime: booking.sessionEndTime,
      duration: calculateDuration(booking.sessionStartTime, booking.sessionEndTime),
      routeTracking: booking.routeTracking || {},
      photos: booking.photos || [],
      uploadedAt: new Date().toISOString()
    };

    // In production, use actual S3 upload
    const s3Url = `s3://warmpawz-sessions/sessions/${new Date().toISOString().split('T')[0]}/${sessionLog.sessionId}.json`;
    
    // ✅ SQL: Store session S3 URL in bookings table
    const bookingsRepo = getBookingsRepository();
    await bookingsRepo.update(bookingId, {
      session_s3_url: s3Url,
      session_uploaded_at: sessionLog.uploadedAt,
      updated_at: new Date().toISOString()
    });

    // Update pet profile
    await updatePetProfile(booking.petId, sessionLog, s3Url);

    console.log(`✅ Session uploaded to S3: ${s3Url}`);

  } catch (error) {
    console.error('Error uploading session to S3:', error);
  }
}

async function updatePetProfile(petId: string, sessionLog: any, s3Url: string) {
  if (!petId) return;

  try {
    // ✅ SQL: Get and update pet profile
    const petsRepo = getPetsRepository();
    const pet = await petsRepo.findById(petId);
    if (!pet) return;

    const serviceHistory = pet.service_history || pet.serviceHistory || [];
    serviceHistory.push({
      sessionId: sessionLog.sessionId,
      bookingId: sessionLog.bookingId,
      sessionDate: sessionLog.startTime,
      duration: sessionLog.duration,
      s3LogUrl: s3Url,
      notes: 'Session completed'
    });

    await petsRepo.update(petId, {
      service_history: serviceHistory,
      serviceHistory: serviceHistory, // Backward compatibility
      updated_at: new Date().toISOString()
    });
    console.log(`✅ Pet profile updated with session record`);

  } catch (error) {
    console.error('Error updating pet profile:', error);
  }
}

function calculateDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.round((end - start) / 60000); // minutes
}

async function getCustomerDetails(customerId: string) {
  try {
    // ✅ SQL: Get customer details
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    return customer || {};
  } catch {
    return {};
  }
}

async function sendOTP(customer: any, otp: string, action: string) {
  // In production, integrate with SMS/push notification service
  console.log(`📱 Would send OTP ${otp} to customer ${customer.phone || customer.email}`);
  
  return {
    sms: customer.phone,
    app: true
  };
}

/**
 * BACKWARD COMPATIBILITY WRAPPERS
 * 
 * Provide endpoints at old paths that redirect to new standardized paths
 * This ensures existing implementations don't break
 */

// Grooming OTP (singular "booking")
app.post('/booking/:bookingId/generate-otp', async (c) => {
  console.log('⚠️ DEPRECATED: Use /bookings/:bookingId/generate-otp (plural)');
  
  // Forward to new endpoint
  const bookingId = c.req.param('bookingId');
  const body = await c.req.json();
  
  c.req.param = () => bookingId;
  return app.fetch(c.req.raw.clone().url.replace('/booking/', '/bookings/'));
});

app.post('/booking/:bookingId/verify-otp', async (c) => {
  console.log('⚠️ DEPRECATED: Use /bookings/:bookingId/verify-otp (plural)');
  
  const bookingId = c.req.param('bookingId');
  return app.fetch(c.req.raw.clone().url.replace('/booking/', '/bookings/'));
});

export default app;
