/**
 * ============================================================================
 * AWS CHIME VIDEO INTEGRATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * This module integrates AWS Chime SDK for video consultations.
 * Configuration is managed via Admin Portal → Platform Settings → Cloud & Maps → AWS Chime
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `video_call_rooms` table for consultation storage
 * - Uses `platform_settings` for AWS settings
 * 
 * Date: 2025-01-28
 * Migration: Batch 15 - KV to SQL (12 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { 
  ChimeSDKMeetingsClient, 
  CreateMeetingCommand, 
  CreateAttendeeCommand,
  DeleteMeetingCommand,
  GetMeetingCommand,
  ListAttendeesCommand
} from "npm:@aws-sdk/client-chime-sdk-meetings@3.450.0";
import { getPlatformSettingsRepository } from "../../lib/repositories/platform-settings.ts";
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();

export function registerAWSChimeVideoEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * Helper: Get AWS Chime Client
   * ✅ SQL: Uses platform_settings table instead of KV
   */
  async function getChimeClient() {
    const platformRepo = getPlatformSettingsRepository();
    const awsSettings = await platformRepo.getAWSSettings();
    
    if (!awsSettings) {
      throw new Error('AWS settings not configured. Please configure in Admin Portal → Platform Settings → AWS');
    }

    const chimeConfig = awsSettings.chime_config || {};
    
    if (!chimeConfig.enabled) {
      throw new Error('AWS Chime is not enabled. Please configure it in Admin Portal → Platform Settings → Cloud & Maps → AWS Chime');
    }

    const credentials = awsSettings.credentials || {};
    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      throw new Error('AWS credentials not configured');
    }

    return new ChimeSDKMeetingsClient({
      region: chimeConfig.region || 'us-east-1',
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      }
    });
  }

  /**
   * GET /video/config
   * Get AWS Chime configuration for frontend
   */
  app.get(`${BASE_PATH}/video/config`, async (c) => {
    try {
      // ✅ SQL: Get AWS settings from platform_settings table
      const platformRepo = getPlatformSettingsRepository();
      const awsSettings = await platformRepo.getAWSSettings();
      
      if (!awsSettings) {
        return c.json({
          success: false,
          enabled: false,
          message: 'AWS settings not configured. Please configure in Admin Portal → Platform Settings → AWS'
        });
      }

      const chimeConfig = awsSettings.chime_config || {};
      
      if (!chimeConfig.enabled) {
        return c.json({
          success: false,
          enabled: false,
          message: 'AWS Chime is not enabled. Please configure it in Admin Portal → Platform Settings → Cloud & Maps → AWS Chime'
        });
      }

      return c.json({
        success: true,
        enabled: true,
        region: chimeConfig.region || 'us-east-1',
        features: {
          video: true,
          audio: true,
          chat: true,
          screenShare: true,
          recording: chimeConfig.recordingEnabled || false
        }
      });
    } catch (error) {
      console.error('❌ [AWS Chime] Error fetching config:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * POST /video/consultation/create
   * Create a new AWS Chime video consultation with real AWS SDK
   */
  app.post(`${BASE_PATH}/video/consultation/create`, async (c) => {
    try {
      const body = await c.req.json();
      const { bookingId, vendorId, customerId, customerName, vendorName, scheduledTime } = body;

      console.log('🎥 [AWS Chime] Creating video consultation for booking:', bookingId);

      // 1. Validate authentication
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
      }

      // 2. Get Chime client
      const chimeClient = await getChimeClient();
      const platformRepo = getPlatformSettingsRepository();
      const awsSettings = await platformRepo.getAWSSettings();
      
      if (!awsSettings) {
        throw new Error('AWS settings not configured');
      }

      const chimeConfig = awsSettings.chime_config || {};

      // 3. Create Chime Meeting
      const createMeetingCommand = new CreateMeetingCommand({
        ClientRequestToken: `warmpawz-${bookingId}-${Date.now()}`,
        MediaRegion: chimeConfig.region || 'us-east-1',
        ExternalMeetingId: bookingId,
        MeetingFeatures: {
          Audio: {
            EchoReduction: 'AVAILABLE'
          }
        }
      });

      const meetingResponse = await chimeClient.send(createMeetingCommand);

      if (!meetingResponse.Meeting) {
        throw new Error('Failed to create Chime meeting');
      }

      const meeting = meetingResponse.Meeting;
      console.log('✅ [AWS Chime] Meeting created:', meeting.MeetingId);

      // 4. Create Customer Attendee
      const customerAttendeeCommand = new CreateAttendeeCommand({
        MeetingId: meeting.MeetingId!,
        ExternalUserId: `customer-${customerId}`
      });

      const customerAttendeeResponse = await chimeClient.send(customerAttendeeCommand);

      // 5. Create Vendor Attendee
      const vendorAttendeeCommand = new CreateAttendeeCommand({
        MeetingId: meeting.MeetingId!,
        ExternalUserId: `vendor-${vendorId}`
      });

      const vendorAttendeeResponse = await chimeClient.send(vendorAttendeeCommand);

      if (!customerAttendeeResponse.Attendee || !vendorAttendeeResponse.Attendee) {
        throw new Error('Failed to create attendees');
      }

      console.log('✅ [AWS Chime] Attendees created');

      // 6. ✅ SQL: Store consultation record in video_call_rooms table
      const consultationId = `chime_consult_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date().toISOString();
      
      const { error: insertError } = await db
        .from('video_call_rooms')
        .insert({
          id: consultationId,
          booking_id: bookingId,
          vendor_id: vendorId,
          customer_id: customerId,
          room_type: 'consultation',
          provider: 'aws_chime',
          meeting_id: meeting.MeetingId!,
          media_region: meeting.MeetingRegion!,
          media_placement: meeting.MediaPlacement as any,
          customer_attendee_id: customerAttendeeResponse.Attendee.AttendeeId!,
          customer_join_token: customerAttendeeResponse.Attendee.JoinToken!,
          vendor_attendee_id: vendorAttendeeResponse.Attendee.AttendeeId!,
          vendor_join_token: vendorAttendeeResponse.Attendee.JoinToken!,
          status: 'scheduled',
          scheduled_time: scheduledTime || now,
          metadata: {
            customerName,
            vendorName,
            region: chimeConfig.region || 'us-east-1'
          }
        });

      if (insertError) {
        console.error('Error storing consultation:', insertError);
        return c.json({ success: false, error: 'Failed to store consultation' }, 500);
      }

      console.log('✅ [AWS Chime] Consultation stored:', consultationId);

      return c.json({
        success: true,
        consultation: {
          id: consultationId,
          meeting: {
            meetingId: meeting.MeetingId!,
            mediaRegion: meeting.MediaRegion!,
            mediaPlacement: meeting.MediaPlacement!
          },
          customerAttendee: {
            attendeeId: customerAttendeeResponse.Attendee.AttendeeId!,
            joinToken: customerAttendeeResponse.Attendee.JoinToken!,
            externalUserId: customerAttendeeResponse.Attendee.ExternalUserId!
          },
          vendorAttendee: {
            attendeeId: vendorAttendeeResponse.Attendee.AttendeeId!,
            joinToken: vendorAttendeeResponse.Attendee.JoinToken!,
            externalUserId: vendorAttendeeResponse.Attendee.ExternalUserId!
          }
        }
      });
    } catch (error) {
      console.error('❌ [AWS Chime] Error creating consultation:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * POST /video/consultation/join
   * Get attendee credentials to join meeting
   */
  app.post(`${BASE_PATH}/video/consultation/join`, async (c) => {
    try {
      const { consultationId, userId, userType } = await c.req.json();

      console.log(`🎥 [AWS Chime] User joining consultation: ${consultationId} as ${userType}`);

      // Validate auth
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
      }

      // ✅ SQL: Get consultation
      const { data: consultation, error } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('id', consultationId)
        .single();

      if (error || !consultation) {
        return c.json({ success: false, error: 'Consultation not found' }, 404);
      }

      // Validate user access
      if (userType === 'customer' && consultation.customer_id !== userId) {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }
      if (userType === 'vendor' && consultation.vendor_id !== userId) {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }

      // Get attendee info
      const attendeeInfo = userType === 'customer' 
        ? {
            attendeeId: consultation.customer_attendee_id,
            joinToken: consultation.customer_join_token,
            externalUserId: `customer-${consultation.customer_id}`
          }
        : {
            attendeeId: consultation.vendor_attendee_id,
            joinToken: consultation.vendor_join_token,
            externalUserId: `vendor-${consultation.vendor_id}`
          };

      console.log('✅ [AWS Chime] Join credentials provided');

      return c.json({
        success: true,
        meeting: {
          meetingId: consultation.meeting_id,
          mediaRegion: consultation.media_region,
          mediaPlacement: consultation.media_placement
        },
        attendee: attendeeInfo
      });
    } catch (error) {
      console.error('❌ [AWS Chime] Error joining consultation:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * GET /video/consultation/:id
   * Get consultation details
   */
  app.get(`${BASE_PATH}/video/consultation/:id`, async (c) => {
    try {
      const { id } = c.req.param();
      
      // ✅ SQL: Get consultation
      const { data: consultation, error } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !consultation) {
        return c.json({ success: false, error: 'Consultation not found' }, 404);
      }

      return c.json({ success: true, consultation });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * GET /video/consultation/booking/:bookingId
   * Get consultation by booking ID
   */
  app.get(`${BASE_PATH}/video/consultation/booking/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      
      // ✅ SQL: Get consultation by booking ID
      const { data: consultation, error } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('booking_id', bookingId)
        .single();
      
      if (error || !consultation) {
        return c.json({ success: false, error: 'Consultation not found for this booking' }, 404);
      }

      return c.json({ success: true, consultation });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * POST /video/consultation/:id/start
   * Start consultation (mark as active)
   */
  app.post(`${BASE_PATH}/video/consultation/:id/start`, async (c) => {
    try {
      const { id } = c.req.param();
      
      // ✅ SQL: Get consultation
      const { data: consultation, error } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !consultation) {
        return c.json({ success: false, error: 'Consultation not found' }, 404);
      }

      const now = new Date().toISOString();

      // ✅ SQL: Update consultation status
      const { data: updated } = await db
        .from('video_call_rooms')
        .update({
          status: 'active',
          started_at: now,
          updated_at: now
        })
        .eq('id', id)
        .select()
        .single();

      console.log('✅ [AWS Chime] Consultation started:', id);

      return c.json({ success: true, consultation: updated });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * POST /video/consultation/:id/end
   * End consultation and cleanup
   */
  app.post(`${BASE_PATH}/video/consultation/:id/end`, async (c) => {
    try {
      const { id } = c.req.param();
      
      // ✅ SQL: Get consultation
      const { data: consultation, error } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !consultation) {
        return c.json({ success: false, error: 'Consultation not found' }, 404);
      }

      // Delete Chime meeting
      try {
        const chimeClient = await getChimeClient();
        await chimeClient.send(new DeleteMeetingCommand({
          MeetingId: consultation.meeting_id
        }));
        console.log('✅ [AWS Chime] Meeting deleted:', consultation.meeting_id);
      } catch (error) {
        console.error('⚠️ [AWS Chime] Error deleting meeting:', error);
        // Continue even if deletion fails
      }

      const now = new Date().toISOString();
      
      // Calculate duration
      let durationSeconds = null;
      if (consultation.started_at) {
        const start = new Date(consultation.started_at).getTime();
        const end = new Date().getTime();
        durationSeconds = Math.floor((end - start) / 1000);
      }

      // ✅ SQL: Update consultation status
      const { data: updated } = await db
        .from('video_call_rooms')
        .update({
          status: 'completed',
          ended_at: now,
          duration_seconds: durationSeconds,
          updated_at: now
        })
        .eq('id', id)
        .select()
        .single();

      console.log('✅ [AWS Chime] Consultation ended:', id);

      return c.json({ success: true, consultation: updated });
    } catch (error) {
      console.error('❌ [AWS Chime] Error ending consultation:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * GET /video/consultation/:id/attendees
   * Get list of attendees in meeting
   */
  app.get(`${BASE_PATH}/video/consultation/:id/attendees`, async (c) => {
    try {
      const { id } = c.req.param();
      
      // ✅ SQL: Get consultation
      const { data: consultation, error } = await db
        .from('video_call_rooms')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !consultation) {
        return c.json({ success: false, error: 'Consultation not found' }, 404);
      }

      const chimeClient = await getChimeClient();
      const response = await chimeClient.send(new ListAttendeesCommand({
        MeetingId: consultation.meeting_id
      }));

      return c.json({
        success: true,
        attendees: response.Attendees || []
      });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  console.log('✅ AWS Chime video endpoints (SQL-only) registered');
}

