/**
 * Agora Video Consultation Integration - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Used for: Veterinarian (tele), Pet Behaviorist (tele), Pet Nutritionist (tele), etc.
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - All data now comes from SQL tables (video_call_rooms, bookings)
 * 
 * Date: 2025-01-28
 * Migration: Batch 9 - 17 KV operations → 0
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';

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
export function agoraVideoEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();
  const bookingsRepo = getBookingsRepository();

  /**
   * POST /video/consultation/create
   * Create a new video consultation room
   */
  app.post(`${BASE_PATH}/video/consultation/create`, async (c) => {
    try {
      const { bookingId, vendorId, customerId, duration } = await c.req.json();
      
      if (!bookingId || !vendorId || !customerId) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Generate unique channel name
      const channelName = `warmpawz_${bookingId}_${Date.now()}`;
      
      // Generate tokens for both participants
      const vendorToken = generateAgoraToken(channelName, parseInt(vendorId.substring(0, 8) || '0', 36), 'publisher');
      const customerToken = generateAgoraToken(channelName, parseInt(customerId.substring(0, 8) || '0', 36), 'publisher');
      
      // Create consultation session
      const consultationId = `consult_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_TIME * 1000).toISOString();

      // ✅ SQL: Create consultation in video_call_rooms table
      const consultationData = {
        id: consultationId,
        booking_id: bookingId,
        room_id: channelName,
        participants: [
          { id: vendorId, role: 'vendor', token: vendorToken },
          { id: customerId, role: 'customer', token: customerToken }
        ],
        status: 'active',
        offer: {
          channelName,
          appId: AGORA_APP_ID,
          vendorToken,
          customerToken,
          duration: duration || 30,
          recordingEnabled: true
        },
        created_at: now,
        updated_at: now
      };

      await db
        .from('video_call_rooms')
        .insert(consultationData);

      // ✅ SQL: Update booking with consultation ID
      await bookingsRepo.update(bookingId, {
        metadata: {
          ...(booking.metadata || {}),
          consultationId,
          consultationStatus: 'scheduled'
        }
      });

      console.log(`✅ Video consultation created: ${consultationId}`);
      
      return c.json({
        success: true,
        consultation: {
          id: consultationId,
          channelName,
          appId: AGORA_APP_ID,
          vendorToken,
          customerToken,
          expiresAt
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
  app.get(`${BASE_PATH}/video/consultation/:consultationId`, async (c) => {
    try {
      const consultationId = c.req.param('consultationId');
      
      // ✅ SQL: Get consultation from video_call_rooms
      const { data: consultation, error } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('id', consultationId)
        .maybeSingle();

      if (error) throw error;
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
  app.post(`${BASE_PATH}/video/consultation/:consultationId/start`, async (c) => {
    try {
      const consultationId = c.req.param('consultationId');
      const { participantType } = await c.req.json(); // 'vendor' or 'customer'
      
      // ✅ SQL: Get consultation
      const { data: consultation, error: fetchError } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('id', consultationId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!consultation) {
        return c.json({ error: 'Consultation not found' }, 404);
      }

      // Update consultation status
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (consultation.status === 'active' && !consultation.offer?.startedAt) {
        updateData.offer = {
          ...(consultation.offer || {}),
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          startedBy: participantType
        };
      }

      // Track participant join
      const participants = consultation.participants || [];
      const participantExists = participants.some((p: any) => p.role === participantType);
      if (!participantExists) {
        participants.push({ role: participantType, joinedAt: new Date().toISOString() });
        updateData.participants = participants;
      }

      // ✅ SQL: Update consultation
      await db
        .from('video_call_rooms')
        .update(updateData)
        .eq('id', consultationId);

      // ✅ SQL: Update booking
      const booking = await bookingsRepo.findById(consultation.booking_id);
      if (booking) {
        await bookingsRepo.update(consultation.booking_id, {
          metadata: {
            ...(booking.metadata || {}),
            consultationStatus: 'in_progress'
          }
        });
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
  app.post(`${BASE_PATH}/video/consultation/:consultationId/end`, async (c) => {
    try {
      const consultationId = c.req.param('consultationId');
      const { duration, notes } = await c.req.json();
      
      // ✅ SQL: Get consultation
      const { data: consultation, error: fetchError } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('id', consultationId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!consultation) {
        return c.json({ error: 'Consultation not found' }, 404);
      }

      // Calculate actual duration
      let actualDuration = duration;
      if (consultation.offer?.startedAt) {
        const start = new Date(consultation.offer.startedAt).getTime();
        const end = Date.now();
        actualDuration = Math.round((end - start) / 1000 / 60); // minutes
      }

      // ✅ SQL: Update consultation status
      const now = new Date().toISOString();
      await db
        .from('video_call_rooms')
        .update({
          status: 'ended',
          ended_at: now,
          duration: actualDuration * 60, // Convert to seconds
          offer: {
            ...(consultation.offer || {}),
            status: 'completed',
            endedAt: now,
            actualDuration,
            notes
          },
          updated_at: now
        })
        .eq('id', consultationId);

      // ✅ SQL: Update booking
      const booking = await bookingsRepo.findById(consultation.booking_id);
      if (booking) {
        await bookingsRepo.update(consultation.booking_id, {
          metadata: {
            ...(booking.metadata || {}),
            consultationStatus: 'completed',
            consultationDuration: actualDuration
          }
        });
      }

      console.log(`✅ Consultation ended: ${consultationId}`);
      
      return c.json({
        success: true,
        consultation: {
          id: consultationId,
          duration: actualDuration,
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
  app.post(`${BASE_PATH}/video/consultation/:consultationId/record`, async (c) => {
    try {
      const consultationId = c.req.param('consultationId');
      const { action } = await c.req.json(); // 'start' or 'stop'
      
      // ✅ SQL: Get consultation
      const { data: consultation, error: fetchError } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('id', consultationId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!consultation) {
        return c.json({ error: 'Consultation not found' }, 404);
      }

      // In production, integrate with Agora Cloud Recording API
      // For now, just update status
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (action === 'start') {
        updateData.offer = {
          ...(consultation.offer || {}),
          recordingStatus: 'recording',
          recordingStartedAt: new Date().toISOString()
        };
        console.log(`🎬 Recording started: ${consultationId}`);
      } else if (action === 'stop') {
        const recordingUrl = `https://storage.warmpawz.com/recordings/${consultationId}.mp4`;
        updateData.offer = {
          ...(consultation.offer || {}),
          recordingStatus: 'stopped',
          recordingStoppedAt: new Date().toISOString(),
          recordingUrl
        };
        console.log(`⏹️ Recording stopped: ${consultationId}`);
      }

      // ✅ SQL: Update consultation
      await db
        .from('video_call_rooms')
        .update(updateData)
        .eq('id', consultationId);
      
      return c.json({
        success: true,
        recordingStatus: updateData.offer?.recordingStatus,
        recordingUrl: updateData.offer?.recordingUrl
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
  app.get(`${BASE_PATH}/video/consultation/booking/:bookingId`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      
      // ✅ SQL: Get consultation by booking_id
      const { data: consultation, error } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (error) throw error;
      if (!consultation) {
        return c.json({ error: 'Consultation not found for this booking' }, 404);
      }

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
  app.get(`${BASE_PATH}/video/config`, async (c) => {
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

  console.log('✅ Agora video consultation endpoints registered (SQL-only)');
}

