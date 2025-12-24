/**
 * ============================================================================
 * TELE-CONSULTATION ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Video call initiation
 * - Call acceptance/rejection
 * - Call management (end call)
 * - Session management
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ No loose strings - use constants
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 * 
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */

import { Hono } from 'npm:hono@4';
import { sendSuccess, sendError } from './response-utils.ts';
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getTeleSessionsRepository } from "../../lib/repositories/tele-sessions.ts";
import {
  TELE_CALL_STATUS,
  TELE_BOOKING_STATUS,
  TELE_DEFAULTS,
  TELE_ERROR_MESSAGES,
  TELE_SUCCESS_MESSAGES,
  TELE_LOG_MESSAGES,
} from './tele-service-constants.ts';
import { SERVICE_STYLE } from './home-service-constants.ts';

export function teleConsultationEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';
  
  /**
   * Start video call (customer initiates)
   * POST /make-server-3dd53475/booking/:bookingId/start-video-call
   */
  app.post(`${BASE}/booking/:bookingId/start-video-call`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { customerId } = await c.req.json();
      
      console.log(`📱 [TELE] Customer ${customerId} starting video call for booking ${bookingId}`);
      
      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, TELE_ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
      }
      
      // Check if it's a tele booking
      if (booking.service_type !== 'tele' && booking.service_style !== 'tele') {
        return sendError(c, TELE_ERROR_MESSAGES.INVALID_BOOKING_TYPE, 400);
      }
      
      // Check booking status
      const validStatuses = [TELE_BOOKING_STATUS.ACCEPTED, 'pending', TELE_BOOKING_STATUS.ASSIGNED];
      if (!validStatuses.includes(booking.status)) {
        return sendError(c, TELE_ERROR_MESSAGES.INVALID_STATUS, 400);
      }
      
      // Check if call time is appropriate (within 10 minutes of appointment time)
      const scheduledDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const appointmentTime = scheduledDateTime.getTime();
      const currentTime = new Date().getTime();
      const timeDiff = Math.abs(appointmentTime - currentTime) / 60000; // minutes
      
      if (timeDiff > TELE_DEFAULTS.CALL_TIME_WINDOW_MINUTES) {
        return sendError(c, TELE_ERROR_MESSAGES.CALL_TIME_WINDOW_EXCEEDED, 400);
      }
      
      // ✅ SQL: Create tele session
      const teleSessionsRepo = getTeleSessionsRepository();
      const sessionId = `tele_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      const teleSession = await teleSessionsRepo.create({
        booking_id: bookingId,
        customer_id: booking.customer_id,
        staff_id: booking.staff_id || '',
        call_status: TELE_CALL_STATUS.RINGING,
        initiated_by: 'customer',
        chat_enabled: true,
      });
      
      // ✅ SQL: Update booking status
      await bookingsRepo.update(bookingId, {
        status: TELE_BOOKING_STATUS.CALL_RINGING,
        notes: JSON.stringify({
          ...(booking.notes ? JSON.parse(booking.notes) : {}),
          teleSessionId: teleSession.id,
          teleCallInitiatedAt: new Date().toISOString(),
        }),
      });
      
      console.log(TELE_LOG_MESSAGES.CALL_INITIATED(teleSession.id));
      
      return sendSuccess(c, {
        teleSession: {
          id: teleSession.id,
          bookingId: teleSession.booking_id,
          callStatus: teleSession.call_status,
          initiatedAt: teleSession.initiated_at,
        },
        booking: {
          id: booking.id,
          status: TELE_BOOKING_STATUS.CALL_RINGING,
        }
      }, TELE_SUCCESS_MESSAGES.CALL_INITIATED);
      
    } catch (error) {
      console.error('❌ [TELE] Error starting video call:', error);
      return sendError(c, TELE_ERROR_MESSAGES.FAILED_START_CALL, 500);
    }
  });
  
  /**
   * Accept video call (staff accepts)
   * POST /make-server-3dd53475/tele-session/:sessionId/accept
   */
  app.post(`${BASE}/tele-session/:sessionId/accept`, async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { staffId } = await c.req.json();
      
      console.log(`📱 [TELE] Staff ${staffId} accepting call ${sessionId}`);
      
      // ✅ SQL: Get tele session
      const teleSessionsRepo = getTeleSessionsRepository();
      const session = await teleSessionsRepo.findById(sessionId);
      
      if (!session) {
        return sendError(c, 'Tele session not found', 404);
      }
      
      if (session.call_status !== TELE_CALL_STATUS.RINGING) {
        return sendError(c, 'Call is not in ringing state', 400);
      }
      
      if (session.staff_id !== staffId) {
        return sendError(c, TELE_ERROR_MESSAGES.UNAUTHORIZED, 403);
      }
      
      // ✅ SQL: Accept call
      const updatedSession = await teleSessionsRepo.accept(sessionId);
      
      // ✅ SQL: Update booking status
      const bookingsRepo = getBookingsRepository();
      await bookingsRepo.update(session.booking_id, {
        status: TELE_BOOKING_STATUS.IN_PROGRESS,
      });
      
      console.log(TELE_LOG_MESSAGES.CALL_ACCEPTED(sessionId));
      
      return sendSuccess(c, {
        session: {
          id: updatedSession.id,
          callStatus: updatedSession.call_status,
          acceptedAt: updatedSession.accepted_at,
        }
      }, TELE_SUCCESS_MESSAGES.CALL_ACCEPTED);
      
    } catch (error) {
      console.error('❌ [TELE] Error accepting call:', error);
      return sendError(c, TELE_ERROR_MESSAGES.FAILED_ACCEPT_CALL, 500);
    }
  });
  
  /**
   * Reject video call (staff rejects)
   * POST /make-server-3dd53475/tele-session/:sessionId/reject
   */
  app.post(`${BASE}/tele-session/:sessionId/reject`, async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { staffId, reason } = await c.req.json();
      
      console.log(`📱 [TELE] Staff ${staffId} rejecting call ${sessionId}`);
      
      // ✅ SQL: Get tele session
      const teleSessionsRepo = getTeleSessionsRepository();
      const session = await teleSessionsRepo.findById(sessionId);
      
      if (!session) {
        return sendError(c, 'Tele session not found', 404);
      }
      
      if (session.staff_id !== staffId) {
        return sendError(c, TELE_ERROR_MESSAGES.UNAUTHORIZED, 403);
      }
      
      // ✅ SQL: Reject call
      const updatedSession = await teleSessionsRepo.reject(sessionId, reason);
      
      // ✅ SQL: Update booking status
      const bookingsRepo = getBookingsRepository();
      await bookingsRepo.update(session.booking_id, {
        status: TELE_BOOKING_STATUS.CANCELLED,
        cancellation_reason: reason || 'Staff declined video call',
        cancelled_at: new Date().toISOString(),
      });
      
      console.log(TELE_LOG_MESSAGES.CALL_REJECTED(sessionId, reason));
      
      // TODO: Initiate refund
      
      return sendSuccess(c, {
        session: {
          id: updatedSession.id,
          callStatus: updatedSession.call_status,
          rejectedAt: updatedSession.rejected_at,
          rejectionReason: updatedSession.rejection_reason,
        }
      }, TELE_SUCCESS_MESSAGES.CALL_REJECTED);
      
    } catch (error) {
      console.error('❌ [TELE] Error rejecting call:', error);
      return sendError(c, TELE_ERROR_MESSAGES.FAILED_REJECT_CALL, 500);
    }
  });
  
  /**
   * End video call (customer or staff ends)
   * POST /make-server-3dd53475/tele-session/:sessionId/end
   */
  app.post(`${BASE}/tele-session/:sessionId/end`, async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { endedBy, durationSeconds } = await c.req.json(); // 'customer' or 'staff'
      
      console.log(`📱 [TELE] Ending call ${sessionId} (ended by: ${endedBy})`);
      
      // ✅ SQL: Get tele session
      const teleSessionsRepo = getTeleSessionsRepository();
      const session = await teleSessionsRepo.findById(sessionId);
      
      if (!session) {
        return sendError(c, 'Tele session not found', 404);
      }
      
      if (session.call_status !== TELE_CALL_STATUS.ACTIVE) {
        return sendError(c, 'Call is not active', 400);
      }
      
      // ✅ SQL: End call
      const updatedSession = await teleSessionsRepo.end(
        sessionId,
        endedBy as 'customer' | 'staff',
        durationSeconds
      );
      
      // ✅ SQL: Update booking status
      const bookingsRepo = getBookingsRepository();
      await bookingsRepo.update(session.booking_id, {
        status: TELE_BOOKING_STATUS.CALL_COMPLETED,
      });
      
      console.log(TELE_LOG_MESSAGES.CALL_ENDED(sessionId, updatedSession.duration_seconds));
      
      return sendSuccess(c, {
        session: {
          id: updatedSession.id,
          callStatus: updatedSession.call_status,
          endedAt: updatedSession.ended_at,
          duration: updatedSession.duration_seconds,
        }
      }, TELE_SUCCESS_MESSAGES.CALL_ENDED);
      
    } catch (error) {
      console.error('❌ [TELE] Error ending call:', error);
      return sendError(c, TELE_ERROR_MESSAGES.FAILED_END_CALL, 500);
    }
  });
}

