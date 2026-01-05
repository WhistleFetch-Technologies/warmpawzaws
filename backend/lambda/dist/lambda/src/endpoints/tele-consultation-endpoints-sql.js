"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.teleConsultationEndpoints = teleConsultationEndpoints;
const response_utils_1 = require("./response-utils");
const bookings_1 = require("../lib/repositories/bookings");
const db_1 = require("../lib/db");
// Inline constants (replacing missing imports)
const TELE_CALL_STATUS = {
    RINGING: 'ringing',
    ACTIVE: 'active',
    ENDED: 'ended',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled'
};
const TELE_BOOKING_STATUS = {
    PENDING_PAYMENT: 'pending_payment',
    PAYMENT_COMPLETED: 'payment_completed',
    AWAITING_ASSIGNMENT: 'awaiting_assignment',
    ASSIGNED: 'assigned',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    CALL_RINGING: 'call_ringing',
    IN_PROGRESS: 'in_progress',
    CALL_COMPLETED: 'call_completed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};
const TELE_DEFAULTS = {
    CALL_TIME_WINDOW_MINUTES: 10
};
const TELE_ERROR_MESSAGES = {
    BOOKING_NOT_FOUND: 'Booking not found',
    INVALID_BOOKING_TYPE: 'Invalid booking type for tele consultation',
    INVALID_STATUS: 'Invalid booking status',
    CALL_TIME_WINDOW_EXCEEDED: 'Call time window exceeded',
    UNAUTHORIZED: 'Unauthorized',
    FAILED_START_CALL: 'Failed to start call',
    FAILED_ACCEPT_CALL: 'Failed to accept call',
    FAILED_REJECT_CALL: 'Failed to reject call',
    FAILED_END_CALL: 'Failed to end call'
};
const TELE_SUCCESS_MESSAGES = {
    CALL_INITIATED: 'Call started successfully',
    CALL_ACCEPTED: 'Call accepted successfully',
    CALL_REJECTED: 'Call rejected',
    CALL_ENDED: 'Call ended successfully'
};
const TELE_LOG_MESSAGES = {
    CALL_INITIATED: (id) => `Tele call initiated: ${id}`,
    CALL_ACCEPTED: (id) => `Tele call accepted: ${id}`,
    CALL_REJECTED: (id, reason) => `Tele call rejected: ${id}${reason ? ` (${reason})` : ''}`,
    CALL_ENDED: (id, duration) => `Tele call ended: ${id}${duration ? ` (${duration}s)` : ''}`
};
const SERVICE_STYLE = {
    TELE: 'tele',
    HOME: 'home',
    CLINIC: 'clinic'
};
function teleConsultationEndpoints(app) {
    const BASE = '/make-server-3dd53475';
    // Helper repository functions (inline SQL replacement)
    const getTeleSessionsRepository = () => ({
        create: async (data) => {
            const [result] = await (0, db_1.insertQuery)('tele_sessions', {
                ...data,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            return result;
        },
        findById: async (sessionId) => {
            const [result] = await (0, db_1.selectQuery)('tele_sessions', { id: sessionId }, { limit: 1 });
            return result || null;
        },
        findByBooking: async (bookingId) => {
            return (0, db_1.selectQuery)('tele_sessions', { booking_id: bookingId });
        },
        update: async (sessionId, data) => {
            const [result] = await (0, db_1.updateQuery)('tele_sessions', { id: sessionId }, {
                ...data,
                updated_at: new Date().toISOString()
            });
            return result;
        }
    });
    const teleSessionsRepo = getTeleSessionsRepository();
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
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, TELE_ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
            }
            // Check if it's a tele booking
            if (booking.service_type !== 'tele' && booking.service_style !== 'tele') {
                return (0, response_utils_1.sendError)(c, TELE_ERROR_MESSAGES.INVALID_BOOKING_TYPE, 400);
            }
            // Check booking status
            const validStatuses = [TELE_BOOKING_STATUS.ACCEPTED, 'pending', TELE_BOOKING_STATUS.ASSIGNED];
            if (!validStatuses.includes(booking.status)) {
                return (0, response_utils_1.sendError)(c, TELE_ERROR_MESSAGES.INVALID_STATUS, 400);
            }
            // Check if call time is appropriate (within 10 minutes of appointment time)
            const scheduledDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
            const appointmentTime = scheduledDateTime.getTime();
            const currentTime = new Date().getTime();
            const timeDiff = Math.abs(appointmentTime - currentTime) / 60000; // minutes
            if (timeDiff > TELE_DEFAULTS.CALL_TIME_WINDOW_MINUTES) {
                return (0, response_utils_1.sendError)(c, TELE_ERROR_MESSAGES.CALL_TIME_WINDOW_EXCEEDED, 400);
            }
            // ✅ SQL: Create tele session
            const sessionId = `tele_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            const teleSession = await teleSessionsRepo.create({
                id: sessionId,
                booking_id: bookingId,
                customer_id: booking.customer_id,
                staff_id: booking.staff_id || '',
                call_status: TELE_CALL_STATUS.RINGING,
                initiated_by: 'customer',
                chat_enabled: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            // ✅ SQL: Update booking status
            await bookingsRepo.update(bookingId, {
                status: TELE_BOOKING_STATUS.CALL_RINGING,
                notes: JSON.stringify({
                    ...(booking.notes ? JSON.parse(booking.notes) : {}),
                    teleSessionId: teleSession?.id || sessionId,
                    teleCallInitiatedAt: new Date().toISOString(),
                }),
            });
            console.log(TELE_LOG_MESSAGES.CALL_INITIATED(teleSession?.id || sessionId));
            return (0, response_utils_1.sendSuccess)(c, {
                teleSession: {
                    id: teleSession?.id || sessionId,
                    bookingId: teleSession?.booking_id || bookingId,
                    callStatus: teleSession?.call_status || TELE_CALL_STATUS.RINGING,
                    initiatedAt: teleSession?.initiated_at || teleSession?.created_at || new Date().toISOString(),
                },
                booking: {
                    id: booking.id,
                    status: TELE_BOOKING_STATUS.CALL_RINGING,
                }
            }, TELE_SUCCESS_MESSAGES.CALL_INITIATED);
        }
        catch (error) {
            console.error('❌ [TELE] Error starting video call:', error);
            return (0, response_utils_1.sendError)(c, TELE_ERROR_MESSAGES.FAILED_START_CALL, 500);
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
            const session = await teleSessionsRepo.findById(sessionId);
            if (!session) {
                return (0, response_utils_1.sendError)(c, 'Tele session not found', 404);
            }
            if (session.call_status !== TELE_CALL_STATUS.RINGING) {
                return (0, response_utils_1.sendError)(c, 'Call is not in ringing state', 400);
            }
            if (session.staff_id !== staffId) {
                return (0, response_utils_1.sendError)(c, TELE_ERROR_MESSAGES.UNAUTHORIZED, 403);
            }
            // ✅ SQL: Accept call - update session
            const updatedSession = await teleSessionsRepo.update(sessionId, {
                call_status: TELE_CALL_STATUS.ACTIVE,
                accepted_at: new Date().toISOString(),
                staff_id: staffId
            });
            // ✅ SQL: Update booking status
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            await bookingsRepo.update(session.booking_id, {
                status: TELE_BOOKING_STATUS.IN_PROGRESS,
            });
            console.log(TELE_LOG_MESSAGES.CALL_ACCEPTED(sessionId));
            return (0, response_utils_1.sendSuccess)(c, {
                session: {
                    id: updatedSession?.id || sessionId,
                    callStatus: updatedSession?.call_status || TELE_CALL_STATUS.ACTIVE,
                    acceptedAt: updatedSession?.accepted_at || new Date().toISOString(),
                }
            }, TELE_SUCCESS_MESSAGES.CALL_ACCEPTED);
        }
        catch (error) {
            console.error('❌ [TELE] Error accepting call:', error);
            return (0, response_utils_1.sendError)(c, TELE_ERROR_MESSAGES.FAILED_ACCEPT_CALL, 500);
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
            const session = await teleSessionsRepo.findById(sessionId);
            if (!session) {
                return (0, response_utils_1.sendError)(c, 'Tele session not found', 404);
            }
            if (session.staff_id !== staffId) {
                return (0, response_utils_1.sendError)(c, TELE_ERROR_MESSAGES.UNAUTHORIZED, 403);
            }
            // ✅ SQL: Reject call - update session
            const updatedSession = await teleSessionsRepo.update(sessionId, {
                call_status: TELE_CALL_STATUS.REJECTED,
                rejected_at: new Date().toISOString(),
                rejection_reason: reason || 'Staff declined'
            });
            // ✅ SQL: Update booking status
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            await bookingsRepo.update(session.booking_id, {
                status: TELE_BOOKING_STATUS.CANCELLED,
                cancellation_reason: reason || 'Staff declined video call',
                cancelled_at: new Date().toISOString(),
            });
            console.log(TELE_LOG_MESSAGES.CALL_REJECTED(sessionId, reason));
            // TODO: Initiate refund
            return (0, response_utils_1.sendSuccess)(c, {
                session: {
                    id: updatedSession?.id || sessionId,
                    callStatus: updatedSession?.call_status || TELE_CALL_STATUS.REJECTED,
                    rejectedAt: updatedSession?.rejected_at || new Date().toISOString(),
                    rejectionReason: updatedSession?.rejection_reason || reason || 'Staff declined',
                }
            }, TELE_SUCCESS_MESSAGES.CALL_REJECTED);
        }
        catch (error) {
            console.error('❌ [TELE] Error rejecting call:', error);
            return (0, response_utils_1.sendError)(c, TELE_ERROR_MESSAGES.FAILED_REJECT_CALL, 500);
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
            const session = await teleSessionsRepo.findById(sessionId);
            if (!session) {
                return (0, response_utils_1.sendError)(c, 'Tele session not found', 404);
            }
            if (session.call_status !== TELE_CALL_STATUS.ACTIVE) {
                return (0, response_utils_1.sendError)(c, 'Call is not active', 400);
            }
            // ✅ SQL: End call - update session
            const updatedSession = await teleSessionsRepo.update(sessionId, {
                call_status: TELE_CALL_STATUS.ENDED,
                ended_at: new Date().toISOString(),
                ended_by: endedBy || 'unknown',
                duration_seconds: durationSeconds || 0
            });
            // ✅ SQL: Update booking status
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            await bookingsRepo.update(session.booking_id, {
                status: TELE_BOOKING_STATUS.CALL_COMPLETED,
            });
            console.log(TELE_LOG_MESSAGES.CALL_ENDED(sessionId, durationSeconds));
            return (0, response_utils_1.sendSuccess)(c, {
                session: {
                    id: updatedSession?.id || sessionId,
                    callStatus: updatedSession?.call_status || TELE_CALL_STATUS.ENDED,
                    endedAt: updatedSession?.ended_at || new Date().toISOString(),
                    duration: updatedSession?.duration_seconds || durationSeconds || 0,
                }
            }, TELE_SUCCESS_MESSAGES.CALL_ENDED);
        }
        catch (error) {
            console.error('❌ [TELE] Error ending call:', error);
            return (0, response_utils_1.sendError)(c, TELE_ERROR_MESSAGES.FAILED_END_CALL, 500);
        }
    });
}
//# sourceMappingURL=tele-consultation-endpoints-sql.js.map