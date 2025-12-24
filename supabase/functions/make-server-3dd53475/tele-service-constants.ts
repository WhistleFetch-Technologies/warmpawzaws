/**
 * ============================================================================
 * TELE CONSULTATION SERVICE CONSTANTS
 * ============================================================================
 * 
 * Constants for tele consultation booking flows
 * No loose strings - all constants defined here
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

// Tele Booking Types
export const TELE_BOOKING_TYPES = {
  INSTANT: 'instant_tele',
  SCHEDULED: 'scheduled_tele',
} as const;

// Tele Session Call Status
export const TELE_CALL_STATUS = {
  RINGING: 'ringing',
  ACTIVE: 'active',
  ENDED: 'ended',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

// Tele Queue Status
export const TELE_QUEUE_STATUS = {
  WAITING: 'waiting',
  ASSIGNED: 'assigned',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// Booking Status for Tele Services
export const TELE_BOOKING_STATUS = {
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
  CANCELLED: 'cancelled',
} as const;

// Default Values
export const TELE_DEFAULTS = {
  CALL_TIME_WINDOW_MINUTES: 10, // Can start call within 10 min of appointment
  ESTIMATED_WAIT_MINUTES: 5, // Default estimated wait time
  MAX_QUEUE_POSITION: 100, // Maximum queue position
} as const;

// Endpoint Paths
export const TELE_ENDPOINTS = {
  INSTANT_BOOKING: '/bookings/instant-tele',
  PROCESS_PAYMENT: '/payments/process-instant-tele',
  START_VIDEO_CALL: '/booking/:bookingId/start-video-call',
  ACCEPT_CALL: '/tele-session/:sessionId/accept',
  REJECT_CALL: '/tele-session/:sessionId/reject',
  END_CALL: '/tele-session/:sessionId/end',
  GET_AVAILABLE_STAFF: '/tele-services/instant/available-staff',
  CREATE_BOOKING: '/tele-services/instant/create-booking',
  ASSIGN_STAFF: '/tele-services/instant/assign-staff',
} as const;

// Error Messages
export const TELE_ERROR_MESSAGES = {
  MISSING_FIELDS: 'Missing required fields',
  BOOKING_NOT_FOUND: 'Booking not found',
  INVALID_BOOKING_TYPE: 'Only tele consultation bookings can have video calls',
  INVALID_STATUS: 'Booking must be accepted to start call',
  CALL_TIME_WINDOW_EXCEEDED: 'Call can only be started within 10 minutes of appointment time',
  STAFF_NOT_FOUND: 'Staff not found',
  UNAUTHORIZED: 'Unauthorized',
  FAILED_CREATE_BOOKING: 'Failed to create booking',
  FAILED_START_CALL: 'Failed to start video call',
  FAILED_ACCEPT_CALL: 'Failed to accept call',
  FAILED_REJECT_CALL: 'Failed to reject call',
  FAILED_END_CALL: 'Failed to end call',
  NO_STAFF_AVAILABLE: 'No staff available at the moment',
} as const;

// Success Messages
export const TELE_SUCCESS_MESSAGES = {
  BOOKING_CREATED: 'Booking created successfully',
  CALL_INITIATED: 'Call initiated. Waiting for staff to accept.',
  CALL_ACCEPTED: 'Call accepted. Consultation started.',
  CALL_REJECTED: 'Call rejected',
  CALL_ENDED: 'Call ended successfully',
  STAFF_ASSIGNED: 'Staff assigned successfully',
} as const;

// Log Messages
export const TELE_LOG_MESSAGES = {
  BOOKING_CREATED: (bookingId: string) => `✅ Created instant tele booking: ${bookingId}`,
  PAYMENT_PROCESSED: (bookingId: string) => `💳 Payment processed for booking: ${bookingId}`,
  CALL_INITIATED: (sessionId: string) => `✅ [TELE] Video call initiated: ${sessionId}`,
  CALL_STARTED: (sessionId: string, customerId: string, bookingId: string) => 
    `📱 [TELE] Customer ${customerId} starting video call for booking ${bookingId}`,
  CALL_ACCEPTED: (sessionId: string) => `✅ [TELE] Call accepted: ${sessionId}`,
  CALL_REJECTED: (sessionId: string, reason?: string) => `❌ [TELE] Call rejected: ${sessionId}${reason ? ` - ${reason}` : ''}`,
  CALL_ENDED: (sessionId: string, duration: number) => `✅ [TELE] Call ended: ${sessionId} (${duration}s)`,
} as const;

