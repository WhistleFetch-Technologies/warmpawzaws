/**
 * STANDARDIZED OTP ENDPOINTS
 * 
 * Aligns existing OTP functionality with checklist specifications
 * Creates wrapper endpoints matching exact paths from handoff checklist
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

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

    // Get booking
    const bookingData = await kv.get(`booking:${bookingId}`);
    if (!bookingData || !bookingData.value) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookingData.value;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Store OTP
    const otpKey = `booking:${bookingId}:otp:session${sessionNumber}:${action}`;
    await kv.set(otpKey, {
      otp,
      sessionNumber,
      action,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      verified: false,
      attempts: 0
    });

    // Send OTP (would integrate with SMS/push notification service)
    const customer = await getCustomerDetails(booking.customerId);
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

    // Get stored OTP
    const otpKey = `booking:${bookingId}:otp:session${sessionNumber}:${action}`;
    const otpData = await kv.get(otpKey);

    if (!otpData || !otpData.value) {
      return c.json({ 
        error: 'OTP not found',
        message: 'Please generate a new OTP'
      }, 400);
    }

    const storedOtp = otpData.value;

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
      storedOtp.attempts += 1;
      await kv.set(otpKey, storedOtp);

      return c.json({
        success: false,
        verified: false,
        message: 'Invalid OTP',
        remainingAttempts: 3 - storedOtp.attempts
      }, 400);
    }

    // OTP verified successfully
    storedOtp.verified = true;
    storedOtp.verifiedAt = new Date().toISOString();
    await kv.set(otpKey, storedOtp);

    // Get booking
    const bookingData = await kv.get(`booking:${bookingId}`);
    const booking = bookingData.value;

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

      booking.sessionStatus = sessionStatus;
      booking.sessionStartTime = startTime;
      booking.sessionNumber = sessionNumber;

      response.sessionStatus = sessionStatus;
      response.startTime = startTime;
      response.message = 'Session started successfully';

      console.log(`✅ Session ${sessionNumber} started for booking ${bookingId}`);

    } else if (action === 'end') {
      // End session
      sessionStatus = 'completed';
      const endTime = new Date().toISOString();

      booking.sessionStatus = sessionStatus;
      booking.sessionEndTime = endTime;

      response.sessionStatus = sessionStatus;
      response.endTime = endTime;
      response.message = 'Session completed successfully';

      // TRIGGER S3 UPLOAD (async)
      setTimeout(() => uploadSessionToS3(bookingId, sessionNumber, booking), 1000);

      console.log(`✅ Session ${sessionNumber} completed for booking ${bookingId}`);
    }

    await kv.set(`booking:${bookingId}`, booking);

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
    
    await kv.set(`session:${sessionLog.sessionId}:s3`, {
      url: s3Url,
      uploaded: true,
      uploadedAt: sessionLog.uploadedAt
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
    const petData = await kv.get(`pet:${petId}`);
    if (!petData || !petData.value) return;

    const pet = petData.value;
    if (!pet.serviceHistory) pet.serviceHistory = [];

    pet.serviceHistory.push({
      sessionId: sessionLog.sessionId,
      bookingId: sessionLog.bookingId,
      sessionDate: sessionLog.startTime,
      duration: sessionLog.duration,
      s3LogUrl: s3Url,
      notes: 'Session completed'
    });

    await kv.set(`pet:${petId}`, pet);
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
    const data = await kv.get(`customer:${customerId}`);
    return data?.value || {};
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
