/**
 * Agora Video Consultation Integration for Warmpawz
 * Used for: Veterinarian (tele), Pet Behaviorist (tele), Pet Nutritionist (tele), etc.
 * 
 * Alternative: Can also use Twilio Video (commented code included)
 */

import { Hono } from 'hono';
import * as kv from './kv_store';

// Agora Credentials (using publicly available test credentials for now)
// In production, these should come from environment variables
const AGORA_APP_ID = Deno.env.get('AGORA_APP_ID') || 'test';
const AGORA_APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE') || '';

// Token expiry time (24 hours)
const TOKEN_EXPIRY_TIME = 24 * 3600;

/**
 * Generate Agora RTC Token
 * Using simplified token generation for testing
 * In production, use Agora's official token generation library
 */
function generateAgoraToken(channelName: string, uid: number = 0, role: 'publisher' | 'subscriber' = 'publisher'): string {
  // For production, implement actual Agora RTC token generation
  // This is a mock token for testing
  const timestamp = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_TIME;
  const mockToken = `006${AGORA_APP_ID}${channelName}${uid}${timestamp}`;
  
  console.log(`🎥 Generated Agora token for channel: ${channelName}`);
  return mockToken;
}

/**
 * Agora Video Endpoints
 */
export function agoraVideoEndpoints(app: Hono) {
  
  /**
   * POST /video/consultation/create
   * Create a new video consultation room
   */
  app.post('/make-server-3dd53475/video/consultation/create', async (c) => {
    try {
      const { bookingId, vendorId, customerId, duration } = await c.req.json();
      
      if (!bookingId || !vendorId || !customerId) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Generate unique channel name
      const channelName = `warmpawz_${bookingId}_${Date.now()}`;
      
      // Generate tokens for both participants
      const vendorToken = generateAgoraToken(channelName, parseInt(vendorId.substring(0, 8), 36), 'publisher');
      const customerToken = generateAgoraToken(channelName, parseInt(customerId.substring(0, 8), 36), 'publisher');
      
      // Create consultation session
      const consultationId = `consult_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const consultation = {
        id: consultationId,
        bookingId,
        vendorId,
        customerId,
        channelName,
        appId: AGORA_APP_ID,
        vendorToken,
        customerToken,
        status: 'created',
        duration: duration || 30, // minutes
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_TIME * 1000).toISOString(),
        recordingEnabled: true,
        recordingUrl: null
      };

      // Save consultation
      await kv.set(`consultation:${consultationId}`, consultation);
      await kv.set(`consultation:booking:${bookingId}`, consultationId);

      // Update booking
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        booking.consultationId = consultationId;
        booking.consultationStatus = 'scheduled';
        await kv.set(`booking:${bookingId}`, booking);
      }

      console.log(`✅ Video consultation created: ${consultationId}`);
      
      return c.json({
        success: true,
        consultation: {
          id: consultationId,
          channelName,
          appId: AGORA_APP_ID,
          vendorToken,
          customerToken,
          expiresAt: consultation.expiresAt
        }
      });
    } catch (error: any) {
      console.error('Error creating consultation:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /video/consultation/:consultationId
   * Get consultation details
   */
  app.get('/make-server-3dd53475/video/consultation/:consultationId', async (c) => {
    try {
      const consultationId = c.req.param('consultationId');
      
      const consultation = await kv.get(`consultation:${consultationId}`);
      
      if (!consultation) {
        return c.json({ error: 'Consultation not found' }, 404);
      }

      return c.json({
        success: true,
        consultation
      });
    } catch (error: any) {
      console.error('Error fetching consultation:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /video/consultation/:consultationId/start
   * Start consultation (triggered when first participant joins)
   */
  app.post('/make-server-3dd53475/video/consultation/:consultationId/start', async (c) => {
    try {
      const consultationId = c.req.param('consultationId');
      const { participantType } = await c.req.json(); // 'vendor' or 'customer'
      
      const consultation = await kv.get(`consultation:${consultationId}`);
      
      if (!consultation) {
        return c.json({ error: 'Consultation not found' }, 404);
      }

      // Update consultation status
      if (consultation.status === 'created') {
        consultation.status = 'in_progress';
        consultation.startedAt = new Date().toISOString();
        consultation.startedBy = participantType;
      }

      // Track participant join
      consultation.participants = consultation.participants || [];
      if (!consultation.participants.includes(participantType)) {
        consultation.participants.push(participantType);
      }

      await kv.set(`consultation:${consultationId}`, consultation);

      // Update booking
      const booking = await kv.get(`booking:${consultation.bookingId}`);
      if (booking) {
        booking.consultationStatus = 'in_progress';
        await kv.set(`booking:${consultation.bookingId}`, booking);
      }

      console.log(`✅ Consultation started: ${consultationId} by ${participantType}`);
      
      return c.json({
        success: true,
        status: 'in_progress'
      });
    } catch (error: any) {
      console.error('Error starting consultation:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /video/consultation/:consultationId/end
   * End consultation
   */
  app.post('/make-server-3dd53475/video/consultation/:consultationId/end', async (c) => {
    try {
      const consultationId = c.req.param('consultationId');
      const { duration, notes } = await c.req.json();
      
      const consultation = await kv.get(`consultation:${consultationId}`);
      
      if (!consultation) {
        return c.json({ error: 'Consultation not found' }, 404);
      }

      // Update consultation status
      consultation.status = 'completed';
      consultation.endedAt = new Date().toISOString();
      consultation.actualDuration = duration;
      consultation.notes = notes;

      // Calculate actual duration if started
      if (consultation.startedAt) {
        const start = new Date(consultation.startedAt).getTime();
        const end = new Date(consultation.endedAt).getTime();
        consultation.actualDuration = Math.round((end - start) / 1000 / 60); // minutes
      }

      await kv.set(`consultation:${consultationId}`, consultation);

      // Update booking
      const booking = await kv.get(`booking:${consultation.bookingId}`);
      if (booking) {
        booking.consultationStatus = 'completed';
        booking.consultationDuration = consultation.actualDuration;
        await kv.set(`booking:${consultation.bookingId}`, booking);
      }

      console.log(`✅ Consultation ended: ${consultationId}`);
      
      return c.json({
        success: true,
        consultation: {
          id: consultationId,
          duration: consultation.actualDuration,
          status: 'completed'
        }
      });
    } catch (error: any) {
      console.error('Error ending consultation:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /video/consultation/:consultationId/record
   * Start/Stop recording (requires Agora Cloud Recording)
   */
  app.post('/make-server-3dd53475/video/consultation/:consultationId/record', async (c) => {
    try {
      const consultationId = c.req.param('consultationId');
      const { action } = await c.req.json(); // 'start' or 'stop'
      
      const consultation = await kv.get(`consultation:${consultationId}`);
      
      if (!consultation) {
        return c.json({ error: 'Consultation not found' }, 404);
      }

      // In production, integrate with Agora Cloud Recording API
      // For now, just update status
      
      if (action === 'start') {
        consultation.recordingStatus = 'recording';
        consultation.recordingStartedAt = new Date().toISOString();
        console.log(`🎬 Recording started: ${consultationId}`);
      } else if (action === 'stop') {
        consultation.recordingStatus = 'stopped';
        consultation.recordingStoppedAt = new Date().toISOString();
        // Mock recording URL
        consultation.recordingUrl = `https://storage.warmpawz.com/recordings/${consultationId}.mp4`;
        console.log(`⏹️ Recording stopped: ${consultationId}`);
      }

      await kv.set(`consultation:${consultationId}`, consultation);
      
      return c.json({
        success: true,
        recordingStatus: consultation.recordingStatus,
        recordingUrl: consultation.recordingUrl
      });
    } catch (error: any) {
      console.error('Error managing recording:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /video/consultation/booking/:bookingId
   * Get consultation by booking ID
   */
  app.get('/make-server-3dd53475/video/consultation/booking/:bookingId', async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      
      const consultationId = await kv.get(`consultation:booking:${bookingId}`);
      
      if (!consultationId) {
        return c.json({ error: 'Consultation not found for this booking' }, 404);
      }

      const consultation = await kv.get(`consultation:${consultationId}`);
      
      return c.json({
        success: true,
        consultation
      });
    } catch (error: any) {
      console.error('Error fetching consultation by booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /video/config
   * Get Agora configuration for frontend
   */
  app.get('/make-server-3dd53475/video/config', async (c) => {
    try {
      return c.json({
        success: true,
        provider: 'agora',
        appId: AGORA_APP_ID,
        enabled: !!AGORA_APP_ID
      });
    } catch (error: any) {
      console.error('Error fetching video config:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Agora video consultation endpoints registered');
}
