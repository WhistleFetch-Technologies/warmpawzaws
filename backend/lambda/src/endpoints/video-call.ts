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

/** Configurable MediaRegion for global users. CHIME_MEDIA_REGION > AWS_REGION > ap-south-1 */
function getMediaRegion(): string {
  return process.env.CHIME_MEDIA_REGION || process.env.AWS_REGION || 'ap-south-1';
}

/** Generate correlation ID for structured logging */
function vidcorId(): string {
  return randomUUID().slice(0, 8);
}

/** Structured log helper */
function vidlog(scope: string, event: string, data: Record<string, unknown>, correlationId?: string): void {
  const payload = JSON.stringify({
    scope: `video-call:${scope}`,
    event,
    vidcor: correlationId || vidcorId(),
    ...data,
    ts: new Date().toISOString(),
  });
  console.log(`[VIDEO CALL] ${payload}`);
}

/** Retry Chime API call with exponential backoff */
async function withChimeRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; correlationId?: string } = {}
): Promise<T> {
  const { maxRetries = 3, correlationId } = opts;
  let lastErr: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      vidlog('chime', 'retry', {
        attempt: i + 1,
        maxRetries,
        error: err?.message || String(err),
      }, correlationId);
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

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

/** Normalize request body: accept snake_case for backward compatibility with mobile */
function normalizeCreateMeetingBody(body: any): { bookingId: string; customerId: string; vendorId: string } {
  const bookingId = body.bookingId ?? body.booking_id;
  const customerId = body.customerId ?? body.customer_id;
  const vendorId = body.vendorId ?? body.vendor_id;
  return { bookingId, customerId, vendorId };
}

/** Normalize join body: accept snake_case and multiple field names (participantId/userId, participantType/userType) */
function normalizeJoinBody(body: any): { bookingId: string; userId: string; userType: string } {
  const bookingId = body.bookingId ?? body.booking_id;
  const userId = body.userId ?? body.participantId ?? body.participant_id ?? body.user_id;
  const userType = (body.userType ?? body.participantType ?? body.participant_type ?? body.user_type)?.toLowerCase?.();
  return { bookingId, userId, userType };
}

class CreateMeetingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId, customerId, vendorId } = normalizeCreateMeetingBody(body);

    if (!bookingId || !customerId || !vendorId) {
      return this.error('bookingId, customerId, and vendorId are required (camelCase or snake_case)', 400);
    }

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

    const cid = vidcorId();
    vidlog('create-meeting', 'start', { bookingId, customerId, vendorId, mediaRegion: getMediaRegion() }, cid);

    const chimeClient = new ChimeSDKMeetingsClient({
      region: process.env.AWS_REGION || 'ap-south-1',
    });

    const meetingResponse = await withChimeRetry(
      () =>
        chimeClient.send(
          new CreateMeetingCommand({
            ClientRequestToken: `booking-${bookingId}-${Date.now()}`,
            MediaRegion: getMediaRegion(),
            ExternalMeetingId: bookingId,
          })
        ),
      { correlationId: cid }
    );

    if (!meetingResponse.Meeting) {
      vidlog('create-meeting', 'error', { bookingId, reason: 'no meeting in response' }, cid);
      return this.error('Failed to create meeting', 500);
    }

    const meetingId = meetingResponse.Meeting.MeetingId!;

    const [customerAttendee, vendorAttendee] = await Promise.all([
      withChimeRetry(
        () =>
          chimeClient.send(
            new CreateAttendeeCommand({
              MeetingId: meetingId,
              ExternalUserId: customerId,
            })
          ),
        { correlationId: cid }
      ),
      withChimeRetry(
        () =>
          chimeClient.send(
            new CreateAttendeeCommand({
              MeetingId: meetingId,
              ExternalUserId: vendorId,
            })
          ),
        { correlationId: cid }
      ),
    ]);

    // ✅ SQL: Store meeting info in video_call_sessions (including join tokens so join returns them)
    await insert('video_call_sessions', {
      booking_id: bookingId,
      meeting_id: meetingId,
      customer_id: customerId,
      vendor_id: vendorId,
      customer_attendee_id: customerAttendee.Attendee?.AttendeeId,
      customer_join_token: customerAttendee.Attendee?.JoinToken,
      vendor_attendee_id: vendorAttendee.Attendee?.AttendeeId,
      vendor_join_token: vendorAttendee.Attendee?.JoinToken,
      status: 'active',
      started_at: new Date(),
    });

    // ✅ SQL: Update booking with video call meeting ID
    await update('bookings', { id: bookingId }, {
      video_call_meeting_id: meetingId,
      video_call_started_at: new Date().toISOString(),
    });

    vidlog('create-meeting', 'success', { bookingId, meetingId }, cid);
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
    const { bookingId, userId, userType } = normalizeJoinBody(body);

    if (!bookingId || !userId || !userType) {
      return this.error('bookingId, participantId (or userId), and participantType (or userType) are required', 400);
    }
    if (!['customer', 'vendor'].includes(userType)) {
      return this.error('participantType/userType must be customer or vendor', 400);
    }

    const cid = vidcorId();
    vidlog('join', 'start', { bookingId, participantId: userId, participantType: userType }, cid);

    // ✅ Ensure table schema exists before any DB access
    await ensureVideoCallSessionsTable();

    // ✅ Verify booking exists and allow only within video call window
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }
    const booking = bookings[0] as any;
    const windowCheck = isWithinVideoCallWindow(booking);
    if (!windowCheck.allowed) {
      return this.error(windowCheck.reason || 'Video call is not allowed for this appointment at this time.', 400);
    }

    // ✅ SQL: Get meeting session (check for active or waiting status)
    const sessions = await select('video_call_sessions', {
      booking_id: bookingId,
    });

    const activeSession = sessions.find((s: any) =>
      s.status === 'active' || s.status === 'waiting'
    );

    // ✅ CREATE-ON-JOIN: If no session exists, create meeting + session so both sides can join without create-meeting first
    let session = activeSession;
    if (!session) {
      const chimeClient = new ChimeSDKMeetingsClient({
        region: process.env.AWS_REGION || 'ap-south-1',
      });
      const customerId = booking.customer_id ?? booking.customerId;
      const vendorId = booking.vendor_id ?? booking.vendorId;
      vidlog('join', 'create-on-join', { bookingId, participantType: userType, participantId: userId }, cid);

      const meetingResponse = await withChimeRetry(
        () =>
          chimeClient.send(
            new CreateMeetingCommand({
              ClientRequestToken: `booking-${bookingId}-${Date.now()}`,
              MediaRegion: getMediaRegion(),
              ExternalMeetingId: bookingId,
            })
          ),
        { correlationId: cid }
      );
      if (!meetingResponse.Meeting?.MeetingId || !meetingResponse.Meeting?.MediaPlacement) {
        vidlog('join', 'error', { bookingId, reason: 'create-on-join no meeting' }, cid);
        return this.error('Failed to create meeting', 500);
      }
      const newMeetingId = meetingResponse.Meeting.MeetingId;

      const attendeeResponse = await withChimeRetry(
        () =>
          chimeClient.send(
            new CreateAttendeeCommand({
              MeetingId: newMeetingId,
              ExternalUserId: `${userType}-${userId}`,
            })
          ),
        { correlationId: cid }
      );
      const newAttendee = {
        AttendeeId: attendeeResponse.Attendee?.AttendeeId,
        JoinToken: attendeeResponse.Attendee?.JoinToken,
        ExternalUserId: `${userType}-${userId}`,
      };

      const sessionRow: Record<string, any> = {
        booking_id: bookingId,
        meeting_id: newMeetingId,
        customer_id: customerId,
        vendor_id: vendorId,
        status: 'waiting',
        started_at: new Date(),
      };
      if (userType === 'customer') {
        sessionRow.customer_attendee_id = newAttendee.AttendeeId;
        sessionRow.customer_join_token = newAttendee.JoinToken;
      } else {
        sessionRow.vendor_attendee_id = newAttendee.AttendeeId;
        sessionRow.vendor_join_token = newAttendee.JoinToken;
      }

      // ✅ RACE FIX: Re-check for existing session right before insert. If the other participant
      // created one concurrently, join that meeting instead of creating a duplicate.
      const recheck = await select('video_call_sessions', { booking_id: bookingId });
      const existingSession = recheck.find((s: any) => s.status === 'active' || s.status === 'waiting');
      if (existingSession) {
        vidlog('join', 'race-avoided-use-existing', {
          bookingId,
          participantType: userType,
          existingMeetingId: existingSession.meeting_id,
        }, cid);
        // Create our attendee in the existing meeting (other participant created it)
        const raceAttendeeResp = await withChimeRetry(
          () =>
            chimeClient.send(
              new CreateAttendeeCommand({
                MeetingId: existingSession.meeting_id,
                ExternalUserId: `${userType}-${userId}`,
              })
            ),
          { correlationId: cid }
        );
        const raceAttendee = {
          AttendeeId: raceAttendeeResp.Attendee?.AttendeeId,
          JoinToken: raceAttendeeResp.Attendee?.JoinToken,
          ExternalUserId: `${userType}-${userId}`,
        };
        const updateData: any = {};
        if (userType === 'customer') {
          updateData.customer_attendee_id = raceAttendee.AttendeeId;
          updateData.customer_join_token = raceAttendee.JoinToken;
        } else {
          updateData.vendor_attendee_id = raceAttendee.AttendeeId;
          updateData.vendor_join_token = raceAttendee.JoinToken;
        }
        await update('video_call_sessions', { id: existingSession.id }, updateData);
        const meetingInfo = (
          await withChimeRetry(
            () => chimeClient.send(new GetMeetingCommand({ MeetingId: existingSession.meeting_id })),
            { correlationId: cid }
          )
        ).Meeting;
        if (!meetingInfo?.MediaPlacement) {
          return this.error('Meeting data invalid', 500);
        }
        return this.success({
          success: true,
          meetingId: existingSession.meeting_id,
          meeting: {
            MeetingId: meetingInfo.MeetingId,
            MediaPlacement: meetingInfo.MediaPlacement,
            MediaRegion: meetingInfo.MediaRegion,
          },
          attendee: raceAttendee,
          session: { id: existingSession.id, status: existingSession.status },
        });
      }

      const inserted = await insert('video_call_sessions', sessionRow);
      session = inserted[0];

      await update('bookings', { id: bookingId }, {
        video_call_meeting_id: newMeetingId,
        video_call_started_at: new Date().toISOString(),
      });

      // Notify vendor when customer joins first (Practo-style "patient waiting")
      if (userType === 'customer' && vendorId) {
        const payload = { booking_id: bookingId, meeting_id: newMeetingId, call_type: 'customer_waiting' };
        const notificationRow: Record<string, any> = {
          recipient_id: vendorId,
          recipient_type: 'vendor',
          notification_type: 'tele_customer_waiting',
          title: 'Customer Waiting',
          message: 'A customer has joined the video consultation and is waiting for you',
          channels: { email: false, sms: false, inApp: true, push: true },
          is_read: false,
          created_at: new Date(),
        };
        notificationRow.data = payload;
        try {
          await insert('notifications', notificationRow);
          vidlog('join', 'tele_customer_waiting-sent', { bookingId, vendorId }, cid);
        } catch (insertErr: any) {
          vidlog('join', 'tele_customer_waiting-fail', { bookingId, err: insertErr?.message }, cid);
          if (insertErr?.message?.includes('data') || insertErr?.message?.includes('column')) {
            delete notificationRow.data;
            await insert('notifications', notificationRow).catch(() => {});
          }
        }
        try {
          const { pushNotificationService } = await import('../lib/services/push-notification-service');
          await pushNotificationService.sendEventNotification({
            eventType: 'tele_customer_waiting',
            recipientId: vendorId,
            recipientType: 'vendor',
            relatedId: bookingId,
            data: { bookingId, meetingId: newMeetingId, callType: 'customer_waiting' },
          });
        } catch (_) {}
      }

      vidlog('join', 'create-on-join-success', { bookingId, meetingId: newMeetingId }, cid);
      return this.success({
        success: true,
        meetingId: newMeetingId,
        meeting: {
          MeetingId: meetingResponse.Meeting.MeetingId,
          MediaPlacement: meetingResponse.Meeting.MediaPlacement,
          MediaRegion: meetingResponse.Meeting.MediaRegion,
        },
        attendee: newAttendee,
        session: { id: session.id, status: session.status },
      });
    }

    const chimeClient = new ChimeSDKMeetingsClient({
      region: process.env.AWS_REGION || 'ap-south-1',
    });

    let meetingInfo;
    try {
      meetingInfo = (
        await withChimeRetry(
          () =>
            chimeClient.send(
              new GetMeetingCommand({
                MeetingId: session.meeting_id,
              })
            ),
          { correlationId: cid }
        )
      ).Meeting;
    } catch (getMeetingError: any) {
      // Meeting expired or deleted in Chime – create a new meeting and let user join
      vidlog('join', 'meeting-expired-recreate', {
        bookingId,
        error: getMeetingError?.message,
      }, cid);
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return this.error('Booking not found', 404);
      }
      const booking = bookings[0] as any;
      const createResponse = await withChimeRetry(
        () =>
          chimeClient.send(
            new CreateMeetingCommand({
              ClientRequestToken: `booking-${bookingId}-${Date.now()}`,
              MediaRegion: getMediaRegion(),
              ExternalMeetingId: bookingId,
            })
          ),
        { correlationId: cid }
      );
      if (!createResponse.Meeting?.MeetingId || !createResponse.Meeting?.MediaPlacement) {
        vidlog('join', 'error', { bookingId, reason: 'recreate failed' }, cid);
        return this.error('Failed to create new meeting', 500);
      }
      const newMeetingId = createResponse.Meeting.MeetingId;
      const attendeeResponse = await withChimeRetry(
        () =>
          chimeClient.send(
            new CreateAttendeeCommand({
              MeetingId: newMeetingId,
              ExternalUserId: `${userType}-${userId}`,
            })
          ),
        { correlationId: cid }
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
      const attendeeResponse = await withChimeRetry(
        () =>
          chimeClient.send(
            new CreateAttendeeCommand({
              MeetingId: session.meeting_id,
              ExternalUserId: `${userType}-${userId}`,
            })
          ),
        { correlationId: cid }
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

    vidlog('join', 'success', { bookingId, meetingId: session.meeting_id, participantType: userType }, cid);
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

    const sessions = await select('video_call_sessions', {
      booking_id: bookingId,
    });
    const sessionsList = sessions as any[];
    const activeSessions = sessionsList.filter(
      (s) => s.status === 'active' || s.status === 'waiting'
    );
    const completedSessions = sessionsList.filter(
      (s) => s.status === 'completed' || s.status === 'ended'
    );
    // Prefer session that has both attendees (avoids stale single-participant sessions from races)
    const activeSession = activeSessions.find(
      (s) => s.customer_attendee_id && s.vendor_attendee_id
    ) || activeSessions[0];

    if (!activeSession) {
      return this.success({
        success: true,
        customerJoined: false,
        vendorJoined: false,
        sessionEnded: completedSessions.length > 0,
        message: completedSessions.length > 0
          ? 'Call has ended'
          : 'No active meeting session',
      });
    }

    const session = activeSession as any;
    return this.success({
      success: true,
      customerJoined: !!(session.customer_attendee_id && session.customer_join_token),
      vendorJoined: !!(session.vendor_attendee_id && session.vendor_join_token),
      sessionEnded: false,
    });
  }
}

class EndMeetingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    // ✅ SQL: End meeting session (include both 'active' and 'waiting' - call can end before both join)
    const allSessions = await select('video_call_sessions', { booking_id: bookingId });
    const sessions = (allSessions as any[]).filter(
      (s) => s.status === 'active' || s.status === 'waiting'
    );

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
      const body = await c.req.json().catch(() => ({})) as Record<string, string>;
      const bookingId = body.bookingId ?? body.booking_id;
      const participantType = (body.participantType ?? body.participant_type)?.toLowerCase?.();
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
    const body = await c.req.json().catch(() => ({})) as Record<string, string>;
    const event = createApiGatewayEvent(c.req, body);
    event.pathParameters = { bookingId: c.req.param('bookingId') || body.bookingId || body.booking_id };
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
  const pathParams = typeof req?.param === 'function' ? req.param() : {};
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(body || {}),
    pathParameters: (pathParams && typeof pathParams === 'object') ? pathParams : {},
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

