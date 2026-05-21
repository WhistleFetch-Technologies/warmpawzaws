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
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query, select, insert, update } from '../../../database/rds-connection';
import { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand, GetMeetingCommand, ListAttendeesCommand } from '@aws-sdk/client-chime-sdk-meetings';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { createHmac, randomUUID } from 'crypto';
import { ensureVideoCallSessionsTable } from '../repository/repository.telecommunication';
import { getMediaRegion, isWithinVideoCallWindow, vidcorId } from '../constants/helpers';
import { BookingStatus, BookingPaymentStatus, isTeleServices, UserType } from 'src/endpoints/constants';
import { createMettingID, createSingleToken, createTokens, vidlog, withChimeRetry } from '../../../aws/aws-Chime-service';
import { pushNotificationService } from '../../../aws/aws-sns-notification-service';
import { getRazorpayConfig } from 'src/utils/payments/razorpay-client';
import {
  completeTeleConsultation,
  loadLatestSessionForBooking,
  recordParticipantJoined,
  recordParticipantLeft,
  resolveCallTimerStateForBooking,
  isParticipantPresent,
} from '../../../utils/tele-completion-service';







/** Video call allowed whenever the appointment is not completed. No time-window restriction. */

/** Persist real join attendance (idempotent). */
async function trackParticipantJoined(
  sessionId: string | undefined,
  userType: string,
  bookingId: string,
  cid: string
): Promise<void> {
  if (!sessionId) return;
  if (userType !== UserType.CUSTOMER && userType !== UserType.VENDOR) return;
  await recordParticipantJoined(
    sessionId,
    userType as 'customer' | 'vendor',
    bookingId,
    cid
  );
}

// ============================================================================
// VIDEO CALL HANDLERS
// ============================================================================

/**
 * Ensure video_call_sessions table has the correct schema.
 * Cached per Lambda invocation to avoid repeated DDL checks.
 */
let _tableVerified = false;


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

    const cid = vidcorId();

    // ✅ Set vendor unavailable for instant tele when they create a meeting
    const ensureVendorUnavailable = async (vendorId: string, reason: string = 'error-recovery') => {
      try {
        const vendorCheck = await select('vendors', { id: vendorId });
        if (vendorCheck.length > 0) {
          const currentValue = vendorCheck[0].available_for_instant_tele;
          if (currentValue === true) {
            await update('vendors', { id: vendorId }, { available_for_instant_tele: false });
            vidlog('create-meeting', 'vendor-unavailable-forced-false', { vendorId, bookingId, reason }, cid);
          }
        }
      } catch (err: any) {
        vidlog('create-meeting', 'vendor-unavailable-check-failed', { vendorId, error: err?.message }, cid);
      }
    };

    try {
      await update('vendors', { id: vendorId }, { available_for_instant_tele: false });
      vidlog('create-meeting', 'vendor-unavailable-set', { vendorId, bookingId }, cid);
    } catch (vendorUpdateErr: any) {
      vidlog('create-meeting', 'vendor-unavailable-set-failed', { vendorId, error: vendorUpdateErr?.message }, cid);
      // Continue anyway - don't block the meeting creation if this fails
    }

    try {
      // Ensure table schema is correct
      await ensureVideoCallSessionsTable(_tableVerified);

      // Verify booking exists and is tele consultation
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
      const isTeleService = isTeleServices.includes(serviceStyle.toLowerCase() as (typeof isTeleServices)[number]);

      if (!isTeleService) {
        console.log(`[VIDEO CALL] Service style check: ${serviceStyle}, booking:`, booking.id);
        // Don't block - allow video call even for non-tele bookings (e.g., emergency follow-ups)
        console.warn(`[VIDEO CALL] Warning: Booking ${bookingId} is not a tele service (${serviceStyle}), allowing anyway`);
      }

      vidlog('create-meeting', 'start', { bookingId, customerId, vendorId, mediaRegion: getMediaRegion() }, cid);

      const chimeClient = new ChimeSDKMeetingsClient({
        region: process.env.AWS_REGION || 'ap-south-1',
      });

      // Check if an active/waiting session already exists for this booking.
      // If yes, return the existing meeting data instead of creating a new one.
      // This prevents the bug where vendor creates meeting A, then customer creates meeting B,
      // and they end up in different rooms.
      // Verify the Chime meeting still exists  and if it does Avoids creating a duplicate meeting return the existing one
      // if it does not exists Meeting expired in Chime — fall through to create a new one
      const existingSessions = await select('video_call_sessions', { booking_id: bookingId });
      const activeSession = existingSessions.find((s: any) => s.status === 'active' || s.status === 'waiting');
      let meetingInfo: any;

      if (activeSession) {
        vidlog('create-meeting', 'reuse-existing', {
          bookingId,
          existingMeetingId: activeSession.meeting_id,
          requestedBy: 'create-meeting',
        }, cid);

        try {
          meetingInfo = (
            await withChimeRetry(
              () => chimeClient.send(new GetMeetingCommand({ MeetingId: activeSession.meeting_id })),
              { correlationId: cid }
            ) as { Meeting?: any }
          ).Meeting;
        } catch (getMeetingErr: any) {
          vidlog('create-meeting', 'existing-meeting-expired', {
            bookingId,
            meetingId: activeSession.meeting_id,
            error: getMeetingErr?.message,
          }, cid);
          meetingInfo = null;
        }
        if (meetingInfo && meetingInfo.MediaPlacement) {
          // ✅ Ensure vendor unavailable even when reusing existing meeting
          await ensureVendorUnavailable(vendorId, 'reuse-existing-meeting');
          vidlog('create-meeting', 'success-reused', { bookingId, meetingId: activeSession.meeting_id }, cid);
          return this.success({
            success: true,
            meetingId: activeSession.meeting_id,
            meeting: {
              MeetingId: meetingInfo.MeetingId,
              MediaRegion: meetingInfo.MediaRegion,
              MediaPlacement: meetingInfo.MediaPlacement,
            },
            attendees: {
              customer: {
                AttendeeId: activeSession.customer_attendee_id,
                JoinToken: activeSession.customer_join_token,
                ExternalUserId: `customer-${customerId}`,
              },
              vendor: {
                AttendeeId: activeSession.vendor_attendee_id,
                JoinToken: activeSession.vendor_join_token,
                ExternalUserId: `vendor-${vendorId}`,
              },
            },
          });
        }
      }

      // create a meeting id for both vendor and customer
      const meetingResponse: any = await createMettingID(chimeClient, bookingId, cid);
      if (!meetingResponse.Meeting) {
        vidlog('create-meeting', 'error', { bookingId, reason: 'no meeting in response' }, cid);
        return this.error('Failed to create meeting', 500);
      }

      const meetingId = meetingResponse.Meeting?.MeetingId!;

      //create tokens for both vendor and customer
      const { customerAttendee, vendorAttendee } = await createTokens(chimeClient, meetingId, customerId, vendorId, cid);

      //Store meeting info in video_call_sessions
      //if exists Update existing session (handles UNIQUE(booking_id) constraint)
      //if it does not exists Insert new session
      const existingRow = existingSessions[0]; // Could be completed/ended
      if (existingRow) {
        await update('video_call_sessions', { booking_id: bookingId }, {
          meeting_id: meetingId,
          customer_id: customerId,
          vendor_id: vendorId,
          customer_attendee_id: customerAttendee.Attendee?.AttendeeId,
          customer_join_token: customerAttendee.Attendee?.JoinToken,
          vendor_attendee_id: vendorAttendee.Attendee?.AttendeeId,
          vendor_join_token: vendorAttendee.Attendee?.JoinToken,
          status: 'active',
          started_at: new Date(),
          ended_at: null,
          updated_at: new Date(),
        });
        console.log(`[VIDEO CALL] Updated existing session for booking ${bookingId}`);
      } else {
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
        console.log(`[VIDEO CALL] Created new session for booking ${bookingId}`);
      }

      // Update booking with video call meeting ID
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
          MediaPlacement: meetingResponse.Meeting.MediaPlacement,
        },
        attendees: {
          customer: {
            AttendeeId: customerAttendee.Attendee?.AttendeeId,
            JoinToken: customerAttendee.Attendee?.JoinToken,
            ExternalUserId: `customer-${customerId}`,
          },
          vendor: {
            AttendeeId: vendorAttendee.Attendee?.AttendeeId,
            JoinToken: vendorAttendee.Attendee?.JoinToken,
            ExternalUserId: `vendor-${vendorId}`,
          },
        },
      });
    } catch (error: any) {
      // ✅ CRITICAL: If vendor was creating meeting and something went wrong, ensure available_for_instant_tele stays false
      await ensureVendorUnavailable(vendorId, 'error-recovery');
      // Re-throw the original error
      throw error;
    }
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

    //  Set vendor unavailable for instant tele when they join a call
    let vendorIdForCleanup: string | null = null;
    const ensureVendorUnavailable = async (vendorId: string, reason: string = 'error-recovery') => {
      try {
        const vendorCheck = await select('vendors', { id: vendorId });
        if (vendorCheck.length > 0) {
          const currentValue = vendorCheck[0].available_for_instant_tele;
          if (currentValue === true) {
            await update('vendors', { id: vendorId }, { available_for_instant_tele: false });
            vidlog('join', 'vendor-unavailable-forced-false', { vendorId, bookingId, reason }, cid);
          }
        }
      } catch (err: any) {
        vidlog('join', 'vendor-unavailable-check-failed', { vendorId, error: err?.message }, cid);
      }
    };

    if (userType === UserType.VENDOR) {
      try {
        vendorIdForCleanup = userId;
        await update('vendors', { id: userId }, { available_for_instant_tele: false });
        vidlog('join', 'vendor-unavailable-set', { vendorId: userId, bookingId }, cid);
      } catch (vendorUpdateErr: any) {
        vidlog('join', 'vendor-unavailable-set-failed', { vendorId: userId, error: vendorUpdateErr?.message }, cid);
        // Continue anyway - don't block the join if this fails
      }
    }

    try {
      //Ensure table schema exists before any DB access
      await ensureVideoCallSessionsTable(_tableVerified);

      //Verify booking exists and allow only within video call window
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return this.error('Booking not found', 404);
      }

      const booking = bookings[0] as any;

      // ✅ Block joining if booking is cancelled or completed
      const nonJoinableStatuses = ['cancelled', 'completed', 'no_show', 'expired'];
      if (nonJoinableStatuses.includes(booking.status)) {
        vidlog('join', 'blocked-non-joinable-status', { bookingId, status: booking.status }, cid);
        return this.error(
          `Cannot join call — booking is ${booking.status}. Please create a new booking.`,
          400
        );
      }

      // ✅ CRITICAL FIX: Don't change status to IN_PROGRESS for instant tele consultations
      // that are CONFIRMED but payment is still PENDING.
      // The status should remain CONFIRMED until payment is completed.
      const isInstantTelePendingPayment =
        booking.is_instant_tele === true &&
        booking.status === BookingStatus.CONFIRMED &&
        booking.payment_status === BookingPaymentStatus.PENDING;

      // Only update to IN_PROGRESS if it's NOT an instant tele with pending payment
      if (!isInstantTelePendingPayment) {
        //update the booking status to in_progress
        const bookingUpdate = await update('bookings', { id: bookingId }, { status: BookingStatus.IN_PROGRESS });
        if (!bookingUpdate) {
          return this.error('Failed to update booking status', 500);
        }
        vidlog('join', 'booking-status-updated', { bookingId, status: BookingStatus.IN_PROGRESS }, cid);
      } else {
        vidlog('join', 'booking-status-skipped', {
          bookingId,
          reason: 'instant_tele_pending_payment',
          currentStatus: booking.status,
          paymentStatus: booking.payment_status
        }, cid);
      }
      const windowCheck = isWithinVideoCallWindow(booking);
      if (!windowCheck.allowed) {
        return this.error(windowCheck.reason || 'Video call is not allowed for this appointment at this time.', 400);
      }

      // Get meeting session (check for active or waiting status)
      const sessions = await select('video_call_sessions', {
        booking_id: bookingId,
      });

      const activeSession = sessions.find((s: any) =>
        s.status === 'active' || s.status === 'waiting'
      );

      // CREATE-ON-JOIN: If no session exists, create meeting + session so both sides can join without create-meeting first
      let session = activeSession;
      if (!session) {
        const chimeClient = new ChimeSDKMeetingsClient({
          region: process.env.AWS_REGION || 'ap-south-1',
        });
        const customerId = booking.customer_id ?? booking.customerId;
        const vendorId = booking.vendor_id ?? booking.vendorId;
        vidlog('join', 'create-on-join', { bookingId, participantType: userType, participantId: userId }, cid);

        //create the mettign id for the new meeting
        const meetingResponse: any = await createMettingID(chimeClient, bookingId, cid);
        if (!meetingResponse.Meeting?.MeetingId || !meetingResponse.Meeting?.MediaPlacement) {
          vidlog('join', 'error', { bookingId, reason: 'create-on-join no meeting' }, cid);
          return this.error('Failed to create meeting', 500);
        }

        const newMeetingId = meetingResponse.Meeting.MeetingId;

        //create the token for the new attendee
        const attendeeResponse: any = await createSingleToken(chimeClient, newMeetingId, userType, userId, cid);
        if (!attendeeResponse.Attendee?.AttendeeId || !attendeeResponse.Attendee?.JoinToken) {
          vidlog('join', 'error', { bookingId, reason: 'create-on-join no attendee' }, cid);
          return this.error('Failed to create attendee', 500);
        }

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
        if (userType === UserType.CUSTOMER) {
          sessionRow.customer_attendee_id = newAttendee.AttendeeId;
          sessionRow.customer_join_token = newAttendee.JoinToken;
        } else if (userType === UserType.VENDOR) {
          sessionRow.vendor_attendee_id = newAttendee.AttendeeId;
          sessionRow.vendor_join_token = newAttendee.JoinToken;
        }

        // ✅ RACE + UNIQUE FIX: Re-check for ANY existing session (including completed/ended).
        // The UNIQUE(booking_id) constraint means we must UPDATE existing rows, not INSERT duplicates.
        const recheck = await select('video_call_sessions', { booking_id: bookingId });
        const raceActiveSession = recheck.find((s: any) => s.status === 'active' || s.status === 'waiting');
        if (raceActiveSession) {
          vidlog('join', 'race-avoided-use-existing', {
            bookingId,
            participantType: userType,
            existingMeetingId: raceActiveSession.meeting_id,
          }, cid);

          // Create our attendee in the existing meeting (other participant created it)
          const raceAttendeeResp: any = await createSingleToken(chimeClient, raceActiveSession.meeting_id, userType, userId, cid);
          if (!raceAttendeeResp.Attendee?.AttendeeId || !raceAttendeeResp.Attendee?.JoinToken) {
            vidlog('join', 'error', { bookingId, reason: 'create-on-join no attendee' }, cid);
            return this.error('Failed to create attendee', 500);
          }

          const raceAttendee = {
            AttendeeId: raceAttendeeResp.Attendee?.AttendeeId,
            JoinToken: raceAttendeeResp.Attendee?.JoinToken,
            ExternalUserId: `${userType}-${userId}`,
          };

          const updateData: any = {};
          if (userType === UserType.CUSTOMER) {
            updateData.customer_attendee_id = raceAttendee.AttendeeId;
            updateData.customer_join_token = raceAttendee.JoinToken;
          } else {
            updateData.vendor_attendee_id = raceAttendee.AttendeeId;
            updateData.vendor_join_token = raceAttendee.JoinToken;
          }

          //update the session with the new attendee
          await update('video_call_sessions', { id: raceActiveSession.id }, updateData);
          const meetingInfo = (
            await withChimeRetry(
              () => chimeClient.send(new GetMeetingCommand({ MeetingId: raceActiveSession.meeting_id })),
              { correlationId: cid }
            ) as { Meeting?: any }
          ).Meeting;
          if (!meetingInfo?.MediaPlacement) {
            return this.error('Meeting data invalid', 500);
          }

          await trackParticipantJoined(raceActiveSession.id, userType, bookingId, cid);
          return this.success({
            success: true,
            meetingId: raceActiveSession.meeting_id,
            meeting: {
              MeetingId: meetingInfo.MeetingId,
              MediaPlacement: meetingInfo.MediaPlacement,
              MediaRegion: meetingInfo.MediaRegion,
            },
            attendee: raceAttendee,
            session: { id: raceActiveSession.id, status: raceActiveSession.status },
          });
        }

        // Check for ANY existing session (completed/ended/cancelled) - UNIQUE(booking_id) means we must update, not insert
        const anyExistingSession = recheck[0];
        if (anyExistingSession) {
          vidlog('join', 'reuse-completed-session', {
            bookingId,
            participantType: userType,
            oldStatus: anyExistingSession.status,
            newMeetingId: newMeetingId,
          }, cid);

          // Update the completed/ended session with new meeting data
          const updateData: Record<string, any> = {
            meeting_id: newMeetingId,
            customer_id: customerId,
            vendor_id: vendorId,
            status: 'waiting',
            started_at: new Date(),
            ended_at: null,
            customer_attendee_id: null,
            customer_join_token: null,
            vendor_attendee_id: null,
            vendor_join_token: null,
          };
          if (userType === UserType.CUSTOMER) {
            updateData.customer_attendee_id = newAttendee.AttendeeId;
            updateData.customer_join_token = newAttendee.JoinToken;
          } else if (userType === UserType.VENDOR) {
            updateData.vendor_attendee_id = newAttendee.AttendeeId;
            updateData.vendor_join_token = newAttendee.JoinToken;
          }

          await update('video_call_sessions', { id: anyExistingSession.id }, updateData);
          session = { ...anyExistingSession, ...updateData, id: anyExistingSession.id };
        } else {
          const inserted = await insert('video_call_sessions', sessionRow);
          session = inserted[0];
        }

        await update('bookings', { id: bookingId }, {
          video_call_meeting_id: newMeetingId,
          video_call_started_at: new Date().toISOString(),
        });

        // Notify vendor when customer joins first (Practo-style "patient waiting")
        if (userType === UserType.CUSTOMER && vendorId) {
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
              await insert('notifications', notificationRow).catch(() => { });
            }
          }
          try {

            await pushNotificationService.sendEventNotification({
              eventType: 'tele_customer_waiting',
              recipientId: vendorId,
              recipientType: 'vendor',
              relatedId: bookingId,
              data: { bookingId, meetingId: newMeetingId, callType: 'customer_waiting' },
            });
          } catch (_) { }
        }

        vidlog('join', 'create-on-join-success', { bookingId, meetingId: newMeetingId }, cid);
        await trackParticipantJoined(session?.id, userType, bookingId, cid);
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
          ) as { Meeting?: any }
        ).Meeting;
      } catch (getMeetingError: any) {
        // Meeting expired or deleted in Chime – create a new meeting and let user join
        vidlog('join', 'meeting-expired-recreate', {
          bookingId,
          error: getMeetingError?.message,
        }, cid);
        // booking already fetched and validated at the start of this handler (line 304-308)

        const createResponse: any = await createMettingID(chimeClient, bookingId, cid);
        if (!createResponse.Meeting?.MeetingId || !createResponse.Meeting?.MediaPlacement) {
          vidlog('join', 'error', { bookingId, reason: 'recreate failed' }, cid);
          return this.error('Failed to create new meeting', 500);
        }
        const newMeetingId = createResponse.Meeting.MeetingId;

        const attendeeResponse: any = await createSingleToken(chimeClient, newMeetingId, userType, userId, cid);
        if (!attendeeResponse.Attendee?.AttendeeId || !attendeeResponse.Attendee?.JoinToken) {
          vidlog('join', 'error', { bookingId, reason: 'recreate failed' }, cid);
          return this.error('Failed to create attendee', 500);
        }

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
        if (userType === UserType.CUSTOMER) {
          updateData.customer_attendee_id = newAttendee.AttendeeId;
          updateData.customer_join_token = newAttendee.JoinToken;
        } else if (userType === UserType.VENDOR) {
          updateData.vendor_attendee_id = newAttendee.AttendeeId;
          updateData.vendor_join_token = newAttendee.JoinToken;
        }
        await update('video_call_sessions', { id: session.id }, updateData);
        await update('bookings', { id: bookingId }, { video_call_meeting_id: newMeetingId, video_call_started_at: new Date().toISOString() });
        await trackParticipantJoined(session.id, userType, bookingId, cid);
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
      if (userType === UserType.CUSTOMER && session.customer_attendee_id && session.customer_join_token) {
        // Attendee already exists with valid token
        attendee = {
          AttendeeId: session.customer_attendee_id,
          JoinToken: session.customer_join_token,
          ExternalUserId: userId,
        };
      } else if (userType === UserType.VENDOR && session.vendor_attendee_id && session.vendor_join_token) {
        // Attendee already exists with valid token
        attendee = {
          AttendeeId: session.vendor_attendee_id,
          JoinToken: session.vendor_join_token,
          ExternalUserId: userId,
        };
      } else {
        const attendeeResponse: any = await createSingleToken(chimeClient, session.meeting_id, userType, userId, cid);
        if (!attendeeResponse.Attendee?.AttendeeId || !attendeeResponse.Attendee?.JoinToken) {
          vidlog('join', 'error', { bookingId, reason: 'recreate failed' }, cid);
          return this.error('Failed to create attendee', 500);
        }

        attendee = {
          AttendeeId: attendeeResponse.Attendee?.AttendeeId,
          JoinToken: attendeeResponse.Attendee?.JoinToken,
          ExternalUserId: `${userType}-${userId}`,
        };

        // Update session with attendee info
        const updateData: any = {};
        if (userType === UserType.CUSTOMER) {
          updateData.customer_attendee_id = attendee.AttendeeId;
          updateData.customer_join_token = attendee.JoinToken;
        } else {
          updateData.vendor_attendee_id = attendee.AttendeeId;
          updateData.vendor_join_token = attendee.JoinToken;
        }

        await update('video_call_sessions', { id: session.id }, updateData);
      }

      vidlog('join', 'success', { bookingId, meetingId: session.meeting_id, participantType: userType }, cid);
      await trackParticipantJoined(session.id, userType, bookingId, cid);
      const refreshedSession = await loadLatestSessionForBooking(bookingId);
      const callTimer = await resolveCallTimerStateForBooking(bookingId, refreshedSession);
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
        callTimer,
      });
    } catch (error: any) {
      // ✅ CRITICAL: If vendor was joining and something went wrong, ensure available_for_instant_tele stays false
      if (vendorIdForCleanup) {
        await ensureVendorUnavailable(vendorIdForCleanup, 'error-recovery');
      }
      // Re-throw the original error
      throw error;
    }
  }
}


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
    const customerJoined =
      isParticipantPresent(session, 'customer') ||
      (!session.customer_left_at &&
        !!(session.customer_attendee_id && session.customer_join_token));
    const vendorJoined =
      isParticipantPresent(session, 'vendor') ||
      (!session.vendor_left_at &&
        !!(session.vendor_attendee_id && session.vendor_join_token));
    const callTimer = await resolveCallTimerStateForBooking(bookingId, session);
    return this.success({
      success: true,
      customerJoined,
      vendorJoined,
      sessionEnded: false,
      teleCompletionStatus: null,
      callTimer,
    });
  }
}

class ParticipantLeftHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const body = this.parseBody(context.event);
    const participantType = (
      body.participantType ?? body.participant_type ?? body.userType ?? body.user_type
    )?.toLowerCase?.();

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }
    if (!participantType || !['customer', 'vendor'].includes(participantType)) {
      return this.error('participantType must be customer or vendor', 400);
    }

    const cid = vidcorId();
    vidlog('participant-left', 'start', { bookingId, participantType }, cid);

    const session = await loadLatestSessionForBooking(bookingId);
    if (!session?.id) {
      return this.error('No video session found for this booking', 404);
    }

    await recordParticipantLeft(
      session.id,
      participantType as 'customer' | 'vendor',
      bookingId,
      cid
    );

    const refreshedSession = await loadLatestSessionForBooking(bookingId);
    const callTimer = await resolveCallTimerStateForBooking(bookingId, refreshedSession);

    return this.success({
      success: true,
      message: 'Participant leave recorded — you can rejoin while time remains on the slot',
      bookingId,
      participantType,
      callTimer,
      canRejoin: callTimer.callRemainingSeconds > 0,
    });
  }
}

class EndMeetingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    const body = this.parseBody(context.event);
    const participantTypeRaw = (
      body.participantType ?? body.participant_type ?? body.userType ?? body.user_type
    )?.toLowerCase?.();
    const participantTypeEnding =
      participantTypeRaw === 'customer' || participantTypeRaw === 'vendor'
        ? (participantTypeRaw as 'customer' | 'vendor')
        : undefined;

    const cid = vidcorId();
    vidlog('end-meeting', 'start', { bookingId, participantTypeEnding }, cid);

    const allSessions = await select('video_call_sessions', { booking_id: bookingId });
    const sessions = (allSessions as any[]).filter(
      (s) => s.status === 'active' || s.status === 'waiting'
    );

    if (sessions.length === 0) {
      // Idempotent: session already ended — return latest qualification if available
      const bookingRows = await select('bookings', { id: bookingId });
      const booking = bookingRows[0] as any;
      vidlog('end-meeting', 'no-active-session', { bookingId }, cid);
      return this.success({
        message: 'Meeting ended',
        qualified: booking?.tele_completion_status === 'qualified',
        teleCompletionStatus: booking?.tele_completion_status ?? null,
        bookingCompleted: booking?.status === 'completed',
        overlapSeconds: null,
      });
    }

    const session = sessions[0];
    const result = await completeTeleConsultation({
      bookingId,
      sessionId: session.id,
      source: 'end_call',
      participantTypeEnding,
      correlationId: cid,
      endSession: true,
    });

    vidlog('end-meeting', 'success', {
      bookingId,
      qualified: result.qualified,
      teleCompletionStatus: result.teleCompletionStatus,
      bookingCompleted: result.bookingCompleted,
    }, cid);

    return this.success({
      message: 'Meeting ended',
      qualified: result.qualified,
      teleCompletionStatus: result.teleCompletionStatus,
      bookingCompleted: result.bookingCompleted,
      overlapSeconds: result.overlapSeconds,
      userMessage: result.message,
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if vendor is actually present in Chime meeting using Chime API
 * This verifies actual attendance, not just database records
 */
async function isVendorInChimeMeeting(meetingId: string, vendorAttendeeId: string | null): Promise<boolean> {
  if (!meetingId || !vendorAttendeeId) {
    return false;
  }

  try {
    const chimeClient = new ChimeSDKMeetingsClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const attendeesResponse = await chimeClient.send(
      new ListAttendeesCommand({
        MeetingId: meetingId,
      })
    );

    const attendees = attendeesResponse.Attendees || [];
    return attendees.some((attendee: any) => attendee.AttendeeId === vendorAttendeeId);
  } catch (chimeError: any) {
    console.warn(`[isVendorInChimeMeeting] Failed to check Chime attendees for meeting ${meetingId}:`, chimeError?.message);
    return false;
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
  const participantLeftHandler = new ParticipantLeftHandler();

  app.post('/video-call/:bookingId/participant-left', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEvent(c.req, body);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await participantLeftHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

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
        const { pushNotificationService } = await import('../../../aws/aws-sns-notification-service');
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


  app.get('/video-call/customer/:customerId/active', async (c) => {
    try {
      const { customerId } = c.req.param();
      if (!customerId) {
        return c.json({ error: 'customerId is required' }, 400);
      }


      const activeSessions = await query(`
        SELECT 
          vcs.id as session_id,
          vcs.booking_id,
          vcs.meeting_id,
          vcs.status,
          vcs.started_at,
          vcs.customer_attendee_id,
          vcs.vendor_attendee_id,
          vcs.customer_join_token,
          vcs.vendor_join_token,
          b.customer_id,
          b.vendor_id,
          b.service_type,
          b.booking_date,
          b.booking_time,
          b.status as booking_status,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.owner_name as vendor_owner_name,
          svc.name as service_name,
          p.name as pet_name,
          c.phone as customer_phone,
          c.full_name as customer_name
        FROM video_call_sessions vcs
        JOIN bookings b ON vcs.booking_id = b.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN services svc ON b.service_id = svc.id
        LEFT JOIN pets p ON b.pet_id = p.id
        LEFT JOIN customers c ON b.customer_id = c.id
        WHERE b.customer_id = $1
          AND b.status NOT IN ('completed', 'cancelled', 'no_show')
          AND (
            -- Active or waiting sessions
            (vcs.status IN ('active', 'waiting'))
            OR
            -- Recently ended sessions (within last 15 minutes) - allows rejoin after page refresh.
            -- The booking-level NOT IN filter above ensures this never resurrects a finalized
            -- consultation card; combined they make the tele "rejoin" banner disappear as soon
            -- as the booking is marked completed (or cancelled / no_show).
            (vcs.status = 'completed' 
             AND vcs.ended_at IS NOT NULL 
             AND vcs.ended_at > (NOW() - INTERVAL '15 minutes'))
          )
        ORDER BY 
          CASE WHEN vcs.status IN ('active', 'waiting') THEN 0 ELSE 1 END,
          vcs.started_at DESC
        LIMIT 5
      `, [customerId]);


      const sessions = (activeSessions as any).rows || [];

      return c.json({
        success: true,
        sessions: sessions.map((s: any) => ({
          sessionId: s.session_id,
          bookingId: s.booking_id,
          meetingId: s.meeting_id,
          customerId: s.customer_id,
          vendorId: s.vendor_id,
          customerPhone: s.customer_phone,
          status: s.status,
          startedAt: s.started_at,
          vendorName: s.vendor_name || s.vendor_owner_name || 'Service Provider',
          vendorPhone: s.vendor_phone,
          serviceName: s.service_name || 'Tele Consultation',
          petName: s.pet_name,
          customerName: s.customer_name,
          bookingDate: s.booking_date,
          bookingTime: s.booking_time,
          bookingStatus: s.booking_status,
          hasExistingAttendee: !!(s.customer_attendee_id && s.customer_join_token),
          meetingExists: !!s.meeting_id,
        })),
        hasActiveCall: sessions.length > 0,
      });

    } catch (error: any) {
      console.error('Error fetching active video calls:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  })

  app.get('/video-call/vendor/:vendorId/active', async (c) => {
    try {
      const { vendorId } = c.req.param();
      if (!vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }

      const activeSessions = await query(`
        SELECT 
          vcs.id as session_id,
          vcs.booking_id,
          vcs.meeting_id,
          vcs.status,
          vcs.started_at,
          vcs.customer_attendee_id,
          vcs.vendor_attendee_id,
          vcs.customer_join_token,
          vcs.vendor_join_token,
          b.customer_id,
          b.vendor_id,
          b.service_type,
          b.booking_date,
          b.booking_time,
          b.status as booking_status,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.owner_name as vendor_owner_name,
          svc.name as service_name,
          p.name as pet_name,
          c.phone as customer_phone,
          c.full_name as customer_name
        FROM video_call_sessions vcs
        JOIN bookings b ON vcs.booking_id = b.id 
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN services svc ON b.service_id = svc.id
        LEFT JOIN pets p ON b.pet_id = p.id
        LEFT JOIN customers c ON b.customer_id = c.id
        WHERE b.vendor_id = $1
          AND (
            -- Active or waiting sessions
            (vcs.status IN ('active', 'waiting') AND b.status != 'completed')
            OR
            -- Recently ended sessions (within last 15 minutes) - allows rejoin after page refresh
            (vcs.status = 'completed' 
             AND vcs.ended_at IS NOT NULL 
             AND vcs.ended_at > (NOW() - INTERVAL '15 minutes')
             AND b.status != 'completed')
          )
        ORDER BY 
          CASE WHEN vcs.status IN ('active', 'waiting') THEN 0 ELSE 1 END,
          vcs.started_at DESC
        LIMIT 5
      `, [vendorId]);

      const sessions = (activeSessions as any).rows || [];

      return c.json({
        success: true,
        sessions: sessions.map((s: any) => ({
          sessionId: s.session_id,
          bookingId: s.booking_id,
          meetingId: s.meeting_id,
          customerId: s.customer_id,
          vendorId: s.vendor_id,
          customerPhone: s.customer_phone,
          status: s.status,
          startedAt: s.started_at,
          vendorName: s.vendor_name || s.vendor_owner_name || 'Service Provider',
          vendorPhone: s.vendor_phone,
          serviceName: s.service_name || 'Tele Consultation',
          petName: s.pet_name,
          customerName: s.customer_name,
          bookingDate: s.booking_date,
          bookingTime: s.booking_time,
          bookingStatus: s.booking_status,
          hasExistingAttendee: !!(s.vendor_attendee_id && s.vendor_join_token),
          meetingExists: !!s.meeting_id,
          vendorJoined: !!(s.vendor_attendee_id && s.vendor_join_token),
          customerJoined: !!(s.customer_attendee_id && s.customer_join_token),
        })),
        hasActiveCall: sessions.length > 0,
      });
    } catch (error: any) {
      console.error('Error fetching active video calls for vendor:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });


  /**
 * POST /customer/tele/confirm-payment
 * Self-contained endpoint for queue-accepted flow.
 * Booking already exists with status='pending_payment'.
 * Verifies Razorpay signature, updates payment + booking, sends notifications.
 * Does NOT depend on /razorpay/verify-payment having run first.
 * Body: bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount
 */
  app.post('/customer/tele/confirm-payment', async (c) => {
    try {
      const body = await c.req.json();
      const {
        bookingId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount,
      } = body;

      if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return c.json({ success: false, error: 'Booking ID and payment verification data required' }, 400);
      }

      // 1. Verify Razorpay signature
      const config = await getRazorpayConfig();
      if (!config?.keySecret) {
        return c.json({ success: false, error: 'Payment configuration error' }, 500);
      }
      const text = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSig = createHmac('sha256', config.keySecret).update(text).digest('hex');
      if (expectedSig !== razorpay_signature) {
        return c.json({ success: false, error: 'Invalid payment signature' }, 400);
      }

      // 2. Fetch booking
      const bookingResult = await query(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
      if (bookingResult.rows.length === 0) {
        return c.json({ success: false, error: 'Booking not found' }, 404);
      }
      const booking = bookingResult.rows[0];

      // Idempotent: if booking is already confirmed+paid or completed+paid, return success
      if ((booking.status === 'confirmed' || booking.status === 'completed') && booking.payment_status === 'paid') {
        const meetRes = await query(`SELECT meeting_id, id FROM video_call_sessions WHERE booking_id = $1 LIMIT 1`, [bookingId]);
        return c.json({
          success: true,
          bookingId,
          meetingId: meetRes.rows[0]?.meeting_id || meetRes.rows[0]?.id || null,
          message: 'Booking already confirmed.',
          alreadyConfirmed: true,
        });
      }

      // Accept v3 bookings: status='confirmed' with payment_status='pending' and is_instant_tele=true
      const isV3Booking = booking.status === 'confirmed' && booking.payment_status === 'pending' && booking.is_instant_tele === true;
      // Accept v2 bookings: status='pending_payment'
      const isV2Booking = booking.status === 'pending_payment';

      if (!isV2Booking && !isV3Booking) {
        return c.json({
          success: false,
          error: `Booking is in "${booking.status}" status with payment_status "${booking.payment_status}". Expected "pending_payment" status or "confirmed" status with pending payment for instant tele bookings.`
        }, 400);
      }

      // 3. Find or create payment record (self-contained — no dependency on verify-payment)
      let paymentResult = await query(
        `SELECT id, booking_id, payment_status FROM payments WHERE razorpay_order_id = $1 LIMIT 1`,
        [razorpay_order_id]
      );
      let payment = paymentResult.rows[0];

      if (payment) {
        // Payment record found — mark it completed if not already
        if (payment.payment_status !== 'completed') {
          await query(
            `UPDATE payments SET payment_status = 'completed', razorpay_payment_id = $1, booking_id = COALESCE(booking_id, $2), completed_at = NOW(), updated_at = NOW() WHERE id = $3`,
            [razorpay_payment_id, bookingId, payment.id]
          );
        } else if (!payment.booking_id) {
          // Already completed but not linked to booking
          await query(`UPDATE payments SET booking_id = $1, updated_at = NOW() WHERE id = $2`, [bookingId, payment.id]);
        }
      } else {
        // No payment record with this razorpay_order_id — try finding by booking_id
        paymentResult = await query(
          `SELECT id, booking_id, payment_status FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [bookingId]
        );
        payment = paymentResult.rows[0];

        if (payment) {
          await query(
            `UPDATE payments SET payment_status = 'completed', razorpay_order_id = $1, razorpay_payment_id = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3`,
            [razorpay_order_id, razorpay_payment_id, payment.id]
          );
        } else {
          // No payment record at all — create one
          await insert('payments', {
            booking_id: bookingId,
            customer_id: booking.customer_id,
            vendor_id: booking.vendor_id,
            razorpay_order_id,
            razorpay_payment_id,
            amount: Number(amount) || Number(booking.total_amount) || 0,
            currency: 'INR',
            payment_method: 'razorpay',
            payment_status: 'completed',
            completed_at: new Date(),
          });
        }
      }

      // 4. Update booking to confirmed/completed + paid

      await update('bookings', { id: bookingId }, {
        status: BookingStatus.CONFIRMED,
        payment_status: 'paid',
        updated_at: new Date(),
        notes: booking.notes
          ? `${booking.notes}\n[Razorpay: ${razorpay_order_id}/${razorpay_payment_id}]`
          : `[Razorpay: ${razorpay_order_id}/${razorpay_payment_id}]`,
      });

      // 5. Get meeting ID
      const meetingResult = await query(`SELECT meeting_id, id FROM video_call_sessions WHERE booking_id = $1 LIMIT 1`, [bookingId]);
      const meetingId = meetingResult.rows[0]?.meeting_id || meetingResult.rows[0]?.id || null;

      // 6. Notifications
      const customerName = (await query(`SELECT COALESCE(full_name, 'Customer') AS name FROM customers WHERE id = $1`, [booking.customer_id]).then((r: any) => r.rows?.[0]?.name)) || 'Customer';
      const vendorName = (await query(`SELECT business_name FROM vendors WHERE id = $1`, [booking.vendor_id]).then((r: any) => r.rows?.[0]?.business_name)) || 'Provider';

      // ✅ FIX: Use correct column names (notification_type, not type), plain objects for JSONB, no non-existent columns
      try {
        await insert('notifications', {
          recipient_id: booking.vendor_id,
          recipient_type: 'vendor',
          notification_type: 'tele_call_incoming',
          title: '📞 Instant Video Call',
          message: `${customerName} has completed payment and is waiting to connect. Join the call now.`,
          data: { booking_id: bookingId, bookingId, call_type: 'incoming', action: 'answer_call', instant: true, meeting_id: meetingId },
          channels: { email: false, sms: false, inApp: true, push: true },
          is_read: false,
        });
      } catch (e) {
        console.error('[confirm-payment] Vendor notification failed:', e);
      }

      try {
        await insert('notifications', {
          recipient_id: booking.customer_id,
          recipient_type: 'customer',
          notification_type: 'tele_call_connecting',
          title: 'Connecting to vet',
          message: `${vendorName} will join shortly. Please wait.`,
          data: { booking_id: bookingId, bookingId, action: 'join_call', instant: true, meeting_id: meetingId },
          channels: { email: false, sms: false, inApp: true, push: true },
          is_read: false,
        });
      } catch (e) {
        console.error('[confirm-payment] Customer notification failed:', e);
      }

      return c.json({ success: true, bookingId, meetingId, message: 'Payment confirmed. Booking is now confirmed.' });
    } catch (error: any) {
      console.error('[confirm-payment] error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
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

