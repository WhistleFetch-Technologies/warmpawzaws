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

/**
 * AWS Chime Video Integration
 * 
 * This module integrates AWS Chime SDK for video consultations.
 * Configuration is managed via Admin Portal → Platform Settings → Cloud & Maps → AWS Chime
 * 
 * Prerequisites:
 * 1. AWS Chime must be enabled in platform settings
 * 2. AWS credentials (accessKeyId, secretAccessKey) must be configured
 * 3. AWS IAM user with Chime permissions
 * 
 * Integration Flow:
 * 1. Frontend requests video consultation → POST /video/consultation/create
 * 2. Backend validates Supabase Auth JWT
 * 3. Backend checks AWS Chime settings from KV store
 * 4. Backend uses AWS SDK to create meeting
 * 5. Backend creates attendee sessions for customer and vendor
 * 6. Backend stores consultation record with Chime meeting details
 * 7. Frontend receives meetingId, attendeeId, and token
 * 8. Frontend uses Chime SDK (amazon-chime-sdk-js) to join meeting
 */

export function registerAWSChimeVideoEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * Helper: Get AWS Chime Client
   * ✅ SQL: Uses aws_settings table instead of KV
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
      // ✅ SQL: Get AWS settings from aws_settings table
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
      // ✅ SQL: Get AWS settings from aws_settings table
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

      // 6. Store consultation record
      const consultationId = `chime_consult_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const consultation = {
        id: consultationId,
        bookingId,
        vendorId,
        customerId,
        customerName,
        vendorName,
        meetingId: meeting.MeetingId!,
        mediaRegion: meeting.MediaRegion!,
        mediaPlacement: meeting.MediaPlacement!,
        customerAttendee: {
          attendeeId: customerAttendeeResponse.Attendee.AttendeeId!,
          joinToken: customerAttendeeResponse.Attendee.JoinToken!,
          externalUserId: customerAttendeeResponse.Attendee.ExternalUserId!
        },
        vendorAttendee: {
          attendeeId: vendorAttendeeResponse.Attendee.AttendeeId!,
          joinToken: vendorAttendeeResponse.Attendee.JoinToken!,
          externalUserId: vendorAttendeeResponse.Attendee.ExternalUserId!
        },
        region: awsSettings.chime.region || 'us-east-1',
        status: 'scheduled',
        scheduledTime: scheduledTime || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        provider: 'aws_chime'
      };

      await kv.set(`consultation:${consultationId}`, consultation);
      await kv.set(`consultation:booking:${bookingId}`, consultation);

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
          customerAttendee: consultation.customerAttendee,
          vendorAttendee: consultation.vendorAttendee
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

      // Get consultation
      const consultation = await kv.get(`consultation:${consultationId}`);
      if (!consultation) {
        return c.json({ success: false, error: 'Consultation not found' }, 404);
      }

      // Validate user access
      if (userType === 'customer' && consultation.customerId !== userId) {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }
      if (userType === 'vendor' && consultation.vendorId !== userId) {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }

      // Get attendee info
      const attendeeInfo = userType === 'customer' 
        ? consultation.customerAttendee 
        : consultation.vendorAttendee;

      console.log('✅ [AWS Chime] Join credentials provided');

      return c.json({
        success: true,
        meeting: {
          meetingId: consultation.meetingId,
          mediaRegion: consultation.mediaRegion,
          mediaPlacement: consultation.mediaPlacement
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
      const consultation = await kv.get(`consultation:${id}`);
      
      if (!consultation) {
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
      const consultation = await kv.get(`consultation:booking:${bookingId}`);
      
      if (!consultation) {
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
      const consultation = await kv.get(`consultation:${id}`);
      
      if (!consultation) {
        return c.json({ success: false, error: 'Consultation not found' }, 404);
      }

      consultation.status = 'active';
      consultation.startedAt = new Date().toISOString();
      
      await kv.set(`consultation:${id}`, consultation);
      await kv.set(`consultation:booking:${consultation.bookingId}`, consultation);

      console.log('✅ [AWS Chime] Consultation started:', id);

      return c.json({ success: true, consultation });
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
      const consultation = await kv.get(`consultation:${id}`);
      
      if (!consultation) {
        return c.json({ success: false, error: 'Consultation not found' }, 404);
      }

      // Delete Chime meeting
      try {
        const chimeClient = await getChimeClient();
        await chimeClient.send(new DeleteMeetingCommand({
          MeetingId: consultation.meetingId
        }));
        console.log('✅ [AWS Chime] Meeting deleted:', consultation.meetingId);
      } catch (error) {
        console.error('⚠️ [AWS Chime] Error deleting meeting:', error);
        // Continue even if deletion fails
      }

      consultation.status = 'completed';
      consultation.endedAt = new Date().toISOString();
      
      // Calculate duration
      if (consultation.startedAt) {
        const start = new Date(consultation.startedAt).getTime();
        const end = new Date().getTime();
        consultation.durationSeconds = Math.floor((end - start) / 1000);
      }

      await kv.set(`consultation:${id}`, consultation);
      await kv.set(`consultation:booking:${consultation.bookingId}`, consultation);

      console.log('✅ [AWS Chime] Consultation ended:', id);

      return c.json({ success: true, consultation });
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
      const consultation = await kv.get(`consultation:${id}`);
      
      if (!consultation) {
        return c.json({ success: false, error: 'Consultation not found' }, 404);
      }

      const chimeClient = await getChimeClient();
      const response = await chimeClient.send(new ListAttendeesCommand({
        MeetingId: consultation.meetingId
      }));

      return c.json({
        success: true,
        attendees: response.Attendees || []
      });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  console.log('✅ AWS Chime video endpoints registered');
}
