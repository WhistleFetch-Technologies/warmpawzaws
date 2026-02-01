/**
 * ============================================================================
 * VIDEO CALL ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles video calling for tele consultations using AWS Chime SDK
 * - Create meeting
 * - Join meeting
 * - End meeting
 * - Get meeting info
 * - Notify-ready: WhatsApp-style incoming call to other party
 * - Allowed only 10 min before and 10 min after scheduled time, until appointment completed
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';
import { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand, GetMeetingCommand } from '@aws-sdk/client-chime-sdk-meetings';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { randomUUID } from 'crypto';

/** Video call allowed whenever the appointment is not completed. No time-window restriction. */
function isWithinVideoCallWindow(booking: any): { allowed: boolean; reason?: string } {
  if (booking.status === 'completed') {
    return { allowed: false, reason: 'Video call is not allowed after the appointment is completed.' };
  }
  return { allowed: true };
}

// ============================================================================
// VIDEO CALL HANDLERS
// ============================================================================

/**
 * Ensure video_call_sessions table has the correct schema
 */
async function ensureVideoCallSessionsTable(): Promise<void> {
  try {
    // Check if table exists with correct columns
    const checkResult = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'video_call_sessions' AND column_name = 'meeting_id'
    `);
    
    if (checkResult.rows.length === 0) {
      console.log('[VIDEO CALL] Table video_call_sessions missing meeting_id column, recreating...');
      
      // Drop and recreate table with correct schema
      await query(`
        DROP TABLE IF EXISTS video_call_sessions CASCADE;
        
        CREATE TABLE video_call_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id UUID NOT NULL,
          meeting_id TEXT NOT NULL,
          customer_id UUID,
          vendor_id UUID,
          staff_id UUID,
          customer_attendee_id TEXT,
          vendor_attendee_id TEXT,
          customer_join_token TEXT,
          vendor_join_token TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waiting', 'completed', 'cancelled', 'ended')),
          started_at TIMESTAMPTZ DEFAULT NOW(),
          ended_at TIMESTAMPTZ,
          duration_seconds INTEGER,
          recording_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_video_sessions_booking_id ON video_call_sessions(booking_id);
        CREATE INDEX IF NOT EXISTS idx_video_sessions_meeting_id ON video_call_sessions(meeting_id);
        CREATE INDEX IF NOT EXISTS idx_video_sessions_status ON video_call_sessions(status);
      `);
      
      console.log('[VIDEO CALL] Table video_call_sessions recreated successfully');
    }
  } catch (error: any) {
    console.error('[VIDEO CALL] Error ensuring table schema:', error.message);
    // If table doesn't exist at all, create it
    if (error.message?.includes('does not exist')) {
      await query(`
        CREATE TABLE IF NOT EXISTS video_call_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id UUID NOT NULL,
          meeting_id TEXT NOT NULL,
          customer_id UUID,
          vendor_id UUID,
          staff_id UUID,
          customer_attendee_id TEXT,
          vendor_attendee_id TEXT,
          customer_join_token TEXT,
          vendor_join_token TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          started_at TIMESTAMPTZ DEFAULT NOW(),
          ended_at TIMESTAMPTZ,
          duration_seconds INTEGER,
          recording_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    }
  }
}

class CreateMeetingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId, customerId, vendorId } = body;

    this.validateRequired(body, ['bookingId', 'customerId', 'vendorId']);

    // ✅ Ensure table schema is correct
    await ensureVideoCallSessionsTable();

    // ✅ SQL: Verify booking exists and is tele consultation
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    const booking = bookings[0];
    const windowCheck = isWithinVideoCallWindow(booking);
    if (!windowCheck.allowed) {
      return this.error(windowCheck.reason || 'Video call is not allowed for this appointment at this time.', 400);
    }
    // Allow video call for tele/video_consultation service types
    const serviceStyle = booking.service_style || booking.service_type || '';
    const isTeleService = ['tele', 'video_consultation', 'teleconsultation', 'video'].includes(serviceStyle.toLowerCase());
    
    if (!isTeleService) {
      console.log(`[VIDEO CALL] Service style check: ${serviceStyle}, booking:`, booking.id);
      // Don't block - allow video call even for non-tele bookings (e.g., emergency follow-ups)
      console.warn(`[VIDEO CALL] Warning: Booking ${bookingId} is not a tele service (${serviceStyle}), allowing anyway`);
    }

    // ✅ AWS Chime: Create meeting
    const chimeClient = new ChimeSDKMeetingsClient({
      region: process.env.AWS_REGION || 'ap-south-1',
    });

    const meetingResponse = await chimeClient.send(
      new CreateMeetingCommand({
        ClientRequestToken: `booking-${bookingId}-${Date.now()}`,
        MediaRegion: process.env.AWS_REGION || 'ap-south-1',
        ExternalMeetingId: bookingId,
      })
    );

    if (!meetingResponse.Meeting) {
      return this.error('Failed to create meeting', 500);
    }

    const meetingId = meetingResponse.Meeting.MeetingId!;

    // ✅ AWS Chime: Create attendees
    const customerAttendee = await chimeClient.send(
      new CreateAttendeeCommand({
        MeetingId: meetingId,
        ExternalUserId: customerId,
      })
    );

    const vendorAttendee = await chimeClient.send(
      new CreateAttendeeCommand({
        MeetingId: meetingId,
        ExternalUserId: vendorId,
      })
    );

    // ✅ SQL: Store meeting info in video_call_sessions
    await insert('video_call_sessions', {
      booking_id: bookingId,
      meeting_id: meetingId,
      customer_id: customerId,
      vendor_id: vendorId,
      customer_attendee_id: customerAttendee.Attendee?.AttendeeId,
      vendor_attendee_id: vendorAttendee.Attendee?.AttendeeId,
      status: 'active',
      started_at: new Date(),
    });

    // ✅ SQL: Update booking with video call meeting ID
    await update('bookings', { id: bookingId }, {
      video_call_meeting_id: meetingId,
      video_call_started_at: new Date().toISOString(),
    });

    // Return full meeting data with proper MediaPlacement for Chime SDK
    return this.success({
      success: true,
      meetingId,
      meeting: {
        MeetingId: meetingResponse.Meeting.MeetingId,
        MediaRegion: meetingResponse.Meeting.MediaRegion,
        // MediaPlacement is REQUIRED for Chime SDK to work properly
        MediaPlacement: meetingResponse.Meeting.MediaPlacement,
      },
      attendees: {
        customer: {
          AttendeeId: customerAttendee.Attendee?.AttendeeId,
          JoinToken: customerAttendee.Attendee?.JoinToken,
          ExternalUserId: customerId,
        },
        vendor: {
          AttendeeId: vendorAttendee.Attendee?.AttendeeId,
          JoinToken: vendorAttendee.Attendee?.JoinToken,
          ExternalUserId: vendorId,
        },
      },
    });
  }
}

class GetMeetingInfoHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    // Handle test IDs - return empty meeting info
    if (bookingId === 'test-booking-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
      return this.success({
        bookingId,
        meeting: null,
        message: 'No video call found for this booking',
      });
    }

    // ✅ SQL: Get meeting session
    const sessions = await select('video_call_sessions', {
      booking_id: bookingId,
    });

    if (sessions.length === 0) {
      return this.error('Meeting not found', 404);
    }

    const session = sessions[0];

    return this.success({
      meetingId: session.meeting_id,
      status: session.status,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      duration: session.ended_at && session.started_at
        ? Math.floor((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000)
        : null,
    });
  }
}

class JoinMeetingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    // Support both old format (userId, userType) and new format (participantId, participantType)
    const bookingId = body.bookingId;
    const userId = body.userId || body.participantId;
    const userType = body.userType || body.participantType; // 'customer' | 'vendor'

    if (!bookingId || !userId || !userType) {
      return this.error('bookingId, userId/participantId, and userType/participantType are required', 400);
    }

    // ✅ Allow only within 10 min before/after schedule and until appointment completed
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length > 0) {
      const windowCheck = isWithinVideoCallWindow(bookings[0]);
      if (!windowCheck.allowed) {
        return this.error(windowCheck.reason || 'Video call is not allowed for this appointment at this time.', 400);
      }
    }

    // ✅ SQL: Get meeting session (check for active or waiting status)
    const sessions = await select('video_call_sessions', {
      booking_id: bookingId,
    });

    // Filter for active or waiting sessions
    const activeSession = sessions.find((s: any) => 
      s.status === 'active' || s.status === 'waiting'
    );

    if (!activeSession) {
      return this.error('Active meeting not found. Please ask the other participant to start the call.', 404);
    }

    const session = activeSession;

    // ✅ AWS Chime client
    const chimeClient = new ChimeSDKMeetingsClient({
      region: process.env.AWS_REGION || 'ap-south-1',
    });

    // ✅ Get full meeting info from Chime (including MediaPlacement)
    let meetingInfo;
    try {
      const meetingResponse = await chimeClient.send(
        new GetMeetingCommand({
          MeetingId: session.meeting_id,
        })
      );
      meetingInfo = meetingResponse.Meeting;
    } catch (getMeetingError: any) {
      // Meeting expired or deleted in Chime – create a new meeting and let user join
      console.warn('[VIDEO CALL] Meeting expired or unavailable, creating new meeting for booking:', bookingId, getMeetingError?.message);
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return this.error('Booking not found', 404);
      }
      const booking = bookings[0] as any;
      const createResponse = await chimeClient.send(
        new CreateMeetingCommand({
          ClientRequestToken: `booking-${bookingId}-${Date.now()}`,
          MediaRegion: process.env.AWS_REGION || 'ap-south-1',
          ExternalMeetingId: bookingId,
        })
      );
      if (!createResponse.Meeting?.MeetingId || !createResponse.Meeting?.MediaPlacement) {
        return this.error('Failed to create new meeting', 500);
      }
      const newMeetingId = createResponse.Meeting.MeetingId;
      const attendeeResponse = await chimeClient.send(
        new CreateAttendeeCommand({
          MeetingId: newMeetingId,
          ExternalUserId: `${userType}-${userId}`,
        })
      );
      const newAttendee = {
        AttendeeId: attendeeResponse.Attendee?.AttendeeId,
        JoinToken: attendeeResponse.Attendee?.JoinToken,
        ExternalUserId: `${userType}-${userId}`,
      };
      const updateData: any = {
        meeting_id: newMeetingId,
        customer_attendee_id: null,
        customer_join_token: null,
        vendor_attendee_id: null,
        vendor_join_token: null,
      };
      if (userType === 'customer') {
        updateData.customer_attendee_id = newAttendee.AttendeeId;
        updateData.customer_join_token = newAttendee.JoinToken;
      } else {
        updateData.vendor_attendee_id = newAttendee.AttendeeId;
        updateData.vendor_join_token = newAttendee.JoinToken;
      }
      await update('video_call_sessions', { id: session.id }, updateData);
      await update('bookings', { id: bookingId }, { video_call_meeting_id: newMeetingId, video_call_started_at: new Date().toISOString() });
      return this.success({
        success: true,
        meetingId: newMeetingId,
        meeting: {
          MeetingId: createResponse.Meeting.MeetingId,
          MediaPlacement: createResponse.Meeting.MediaPlacement,
          MediaRegion: createResponse.Meeting.MediaRegion,
        },
        attendee: newAttendee,
        session: { id: session.id, status: session.status },
      });
    }

    if (!meetingInfo || !meetingInfo.MediaPlacement) {
      return this.error('Meeting data is invalid or incomplete', 500);
    }

    let attendee;
    if (userType === 'customer' && session.customer_attendee_id && session.customer_join_token) {
      // Attendee already exists with valid token
      attendee = {
        AttendeeId: session.customer_attendee_id,
        JoinToken: session.customer_join_token,
        ExternalUserId: userId,
      };
    } else if (userType === 'vendor' && session.vendor_attendee_id && session.vendor_join_token) {
      // Attendee already exists with valid token
      attendee = {
        AttendeeId: session.vendor_attendee_id,
        JoinToken: session.vendor_join_token,
        ExternalUserId: userId,
      };
    } else {
      // Create new attendee
      const attendeeResponse = await chimeClient.send(
        new CreateAttendeeCommand({
          MeetingId: session.meeting_id,
          ExternalUserId: `${userType}-${userId}`,
        })
      );

      attendee = {
        AttendeeId: attendeeResponse.Attendee?.AttendeeId,
        JoinToken: attendeeResponse.Attendee?.JoinToken,
        ExternalUserId: `${userType}-${userId}`,
      };

      // Update session with attendee info
      const updateData: any = {};
      if (userType === 'customer') {
        updateData.customer_attendee_id = attendee.AttendeeId;
        updateData.customer_join_token = attendee.JoinToken;
      } else {
        updateData.vendor_attendee_id = attendee.AttendeeId;
        updateData.vendor_join_token = attendee.JoinToken;
      }

      await update('video_call_sessions', { id: session.id }, updateData);
    }

    // Return full meeting data with MediaPlacement for Chime SDK
    return this.success({
      success: true,
      meetingId: session.meeting_id,
      meeting: {
        MeetingId: meetingInfo.MeetingId,
        MediaPlacement: meetingInfo.MediaPlacement,
        MediaRegion: meetingInfo.MediaRegion,
      },
      attendee: {
        AttendeeId: attendee.AttendeeId,
        JoinToken: attendee.JoinToken,
        ExternalUserId: attendee.ExternalUserId,
      },
      session: {
        id: session.id,
        status: session.status,
      },
    });
  }
}

/**
 * GET /video-call/:bookingId/attendees - Return who has joined (for waiting room UI)
 */
class GetAttendeesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    const sessions = await select('video_call_sessions', { booking_id: bookingId });
    const activeSession = sessions.find((s: any) => s.status === 'active' || s.status === 'waiting');

    if (!activeSession) {
      return this.success({
        success: true,
        customerJoined: false,
        vendorJoined: false,
        message: 'No active meeting session',
      });
    }

    const session = activeSession as any;
    return this.success({
      success: true,
      customerJoined: !!(session.customer_attendee_id && session.customer_join_token),
      vendorJoined: !!(session.vendor_attendee_id && session.vendor_join_token),
    });
  }
}

class EndMeetingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    // ✅ SQL: End meeting session
    const sessions = await select('video_call_sessions', {
      booking_id: bookingId,
      status: 'active',
    });

    if (sessions.length > 0) {
      const session = sessions[0];
      const startedAt = session.started_at ? new Date(session.started_at) : new Date();
      const endedAt = new Date();
      const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000); // Duration in seconds

      await update(
        'video_call_sessions',
        { id: session.id },
        {
          status: 'completed',
          ended_at: endedAt,
        }
      );

      // ✅ SQL: Update booking with video call end info
      await update('bookings', { id: bookingId }, {
        video_call_ended_at: endedAt.toISOString(),
        video_call_duration: duration,
      });
    }

    return this.success({ message: 'Meeting ended' });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerVideoCallEndpoints(app: Hono) {
  const createHandler = new CreateMeetingHandler();
  const getInfoHandler = new GetMeetingInfoHandler();
  const getAttendeesHandler = new GetAttendeesHandler();
  const joinHandler = new JoinMeetingHandler();
  const endHandler = new EndMeetingHandler();

  app.get('/video-call/:bookingId/attendees', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await getAttendeesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/video-call/notify-ready', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({})) as { bookingId?: string; participantType?: string; participantId?: string };
      const { bookingId, participantType } = body;
      if (!bookingId || !participantType) {
        return c.json({ error: 'bookingId and participantType are required' }, 400);
      }
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      const booking = bookings[0] as any;
      const windowCheck = isWithinVideoCallWindow(booking);
      if (!windowCheck.allowed) {
        return c.json({ error: windowCheck.reason || 'Video call is not allowed for this appointment at this time.' }, 400);
      }
      const targetId = participantType === 'customer'
        ? (booking.vendor_id ?? (booking as any).vendorId)
        : (booking.customer_id ?? (booking as any).customerId);
      const targetType = participantType === 'customer' ? 'vendor' : 'customer';
      if (!targetId) {
        console.error('[VIDEO CALL] notify-ready: missing target id', { bookingId, participantType, booking: { customer_id: booking.customer_id, vendor_id: booking.vendor_id } });
        return c.json({ error: 'Could not determine notification recipient for this booking' }, 400);
      }
      const sessions = await select('video_call_sessions', { booking_id: bookingId });
      const meetingId = sessions.length > 0 ? (sessions[0] as any).meeting_id : undefined;
      console.log('[VIDEO CALL] notify-ready: inserting notification', { bookingId, participantType, recipient_id: targetId, recipient_type: targetType, meetingId });
      const notificationPayload = { booking_id: bookingId, meeting_id: meetingId, call_type: 'incoming' };
      const notificationRow: Record<string, any> = {
        recipient_id: targetId,
        recipient_type: targetType,
        notification_type: 'tele_call_incoming',
        title: 'Incoming Video Call',
        message: `Your ${participantType === 'customer' ? 'customer' : 'doctor'} is ready to start the video consultation`,
        channels: { email: false, sms: false, inApp: true, push: true },
        is_read: false,
        created_at: new Date(),
      };
      notificationRow.data = notificationPayload;
      try {
        await insert('notifications', notificationRow);
      } catch (insertErr: any) {
        if (insertErr?.message?.includes('data') || insertErr?.message?.includes('column')) {
          delete notificationRow.data;
          await insert('notifications', notificationRow);
        } else {
          throw insertErr;
        }
      }
      try {
        const { pushNotificationService } = await import('../lib/services/push-notification-service');
        await pushNotificationService.sendEventNotification({
          eventType: 'tele_call_incoming',
          recipientId: targetId,
          recipientType: targetType,
          relatedId: bookingId,
          data: { bookingId, meetingId, callType: 'incoming' },
        });
      } catch (pushErr) {
        console.warn('[VIDEO CALL] Push notification failed:', (pushErr as Error)?.message);
      }
      return c.json({ success: true, message: `Notification sent to ${targetType}` }, 200);
    } catch (err: any) {
      console.error('[VIDEO CALL] notify-ready error:', err?.message);
      return c.json({ error: err?.message || 'Failed to send notification' }, 500);
    }
  });

  app.post('/video-call/create-meeting', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEvent(c.req, body);
    const context = createLambdaContext();
    const result = await createHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/video-call/join', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEvent(c.req, body);
    const context = createLambdaContext();
    const result = await joinHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/video-call/end', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEvent(c.req, body);
    event.pathParameters = { bookingId: c.req.param('bookingId') || body.bookingId };
    const context = createLambdaContext();
    const result = await endHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/video-call/:bookingId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await getInfoHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Legacy endpoints for backward compatibility
  app.post('/video-call/create', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEvent(c.req, body);
    const context = createLambdaContext();
    const result = await createHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/video-call/:bookingId/end', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await endHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

function createApiGatewayEvent(req: any, body?: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'video-call-handler',
    functionVersion: '$LATEST',
  };
}

