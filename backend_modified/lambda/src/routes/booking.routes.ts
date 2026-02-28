/**
 * ============================================================================
 * BOOKING ROUTES
 * ============================================================================
 * 
 * Route registration for booking endpoints
 * 
 * Date: 2026-01-28
 * Phase 5: Booking domain restructuring
 * ============================================================================
 */

import { Hono } from 'hono';

// Import from original backend (to be extracted to controllers/booking/)
import { registerBookingEndpointsEnhanced } from '../endpoints/bookings-enhanced';
import { registerFollowupRescheduleEndpoints } from '../endpoints/followup-reschedule';
import { registerAppointmentReminderEndpoints } from '../endpoints/appointment-reminders';
import { registerPackageBookingEndpoints } from '../endpoints/package-booking';
import { registerPackageSessionEndpoints } from '../endpoints/package-sessions';
import { registerSchedulingPolicyEndpoints } from '../endpoints/scheduling-policies';

/**
 * Register all booking-related routes
 * Preserves exact route registration order from handler/index.ts
 */
export function registerBookingRoutes(app: Hono) {
  registerFollowupRescheduleEndpoints(app);
  registerBookingEndpointsEnhanced(app);
  registerAppointmentReminderEndpoints(app);
  registerPackageBookingEndpoints(app);
  registerPackageSessionEndpoints(app);
  registerSchedulingPolicyEndpoints(app);
}
