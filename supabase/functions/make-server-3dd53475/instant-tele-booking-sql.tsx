/**
 * ============================================================================
 * INSTANT TELE BOOKING - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Payment-first flow
 * - Auto-assignment after payment
 * - Staff ranking algorithm
 * - Queue management
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

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { generateId } from './database-schema.tsx';
import { sendSuccess, sendError } from './response-utils.ts';
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getTeleQueuesRepository } from "../../lib/repositories/tele-queues.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";

// Ensure notifications repository is exported
if (!getNotificationsRepository) {
  throw new Error('NotificationsRepository not available');
}
import {
  TELE_BOOKING_TYPES,
  TELE_BOOKING_STATUS,
  TELE_ERROR_MESSAGES,
  TELE_SUCCESS_MESSAGES,
  TELE_LOG_MESSAGES,
} from './tele-service-constants.ts';
import { SERVICE_STYLE } from './home-service-constants.ts';

const app = new Hono();
app.use('*', cors());

/**
 * POST /bookings/instant-tele
 * Create instant tele booking (payment-first)
 */
app.post('/bookings/instant-tele', async (c) => {
  try {
    const body = await c.req.json();
    const {
      serviceId,
      serviceName,
      candidateDoctorIds,
      amount,
      customerId,
      petId
    } = body;

    // Validation
    if (!serviceId || !candidateDoctorIds || candidateDoctorIds.length === 0) {
      return sendError(c, TELE_ERROR_MESSAGES.MISSING_FIELDS, 400);
    }

    // ✅ SQL: Create booking with pending_payment status
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.create({
      customer_id: customerId,
      service_id: serviceId,
      booking_date: new Date().toISOString().split('T')[0],
      booking_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      service_type: TELE_BOOKING_TYPES.INSTANT,
      base_price: parseFloat(amount),
      total_amount: parseFloat(amount),
      notes: JSON.stringify({
        type: TELE_BOOKING_TYPES.INSTANT,
        serviceName,
        candidateDoctorIds,
        petId,
      }),
    });

    console.log(TELE_LOG_MESSAGES.BOOKING_CREATED(booking.id));

    // ✅ SQL: Load candidate doctor details
    const staffRepo = getStaffRepository();
    const candidateDoctors = [];
    for (const doctorId of candidateDoctorIds) {
      const staff = await staffRepo.findById(doctorId);
      if (staff) {
        candidateDoctors.push({
          id: staff.id,
          name: staff.fullName,
          rating: staff.rating || 4.5,
          isOnline: true, // Can be enhanced with real availability check
        });
      }
    }

    return sendSuccess(c, {
      bookingId: booking.id,
      status: TELE_BOOKING_STATUS.PENDING_PAYMENT,
      candidateDoctors,
      amount: parseFloat(amount),
      createdAt: booking.created_at
    });

  } catch (error: any) {
    console.error('Error creating instant tele booking:', error);
    return sendError(c, TELE_ERROR_MESSAGES.FAILED_CREATE_BOOKING, 500);
  }
});

/**
 * POST /payments/process-instant-tele
 * Process payment and trigger auto-assignment
 */
app.post('/payments/process-instant-tele', async (c) => {
  try {
    const { bookingId, amount, paymentMethod, paymentId } = await c.req.json();

    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return sendError(c, TELE_ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
    const candidateDoctorIds = bookingNotes.candidateDoctorIds || [];

    // ✅ SQL: Update booking with payment info
    await bookingsRepo.update(bookingId, {
      payment_status: 'paid',
      payment_id: paymentId,
      status: TELE_BOOKING_STATUS.AWAITING_ASSIGNMENT,
      notes: JSON.stringify({
        ...bookingNotes,
        paymentId,
        paymentMethod,
        paidAt: new Date().toISOString(),
      }),
    });

    console.log(TELE_LOG_MESSAGES.PAYMENT_PROCESSED(bookingId));

    // TRIGGER AUTO-ASSIGNMENT (async)
    // In production, this would be a background job/webhook
    setTimeout(() => autoAssignInstantTele(bookingId, candidateDoctorIds), 1000);

    return sendSuccess(c, {
      bookingId,
      status: TELE_BOOKING_STATUS.AWAITING_ASSIGNMENT,
    }, 'Payment successful. Assigning doctor...');

  } catch (error: any) {
    console.error('Error processing payment:', error);
    return sendError(c, 'Error processing payment', 500);
  }
});

/**
 * Auto-assign doctor from candidate pool
 */
async function autoAssignInstantTele(bookingId: string, candidateStaffIds: string[]) {
  try {
    console.log(`🔍 Starting auto-assignment for booking: ${bookingId}`);

    // ✅ SQL: Load candidates
    const staffRepo = getStaffRepository();
    const candidates = [];
    for (const staffId of candidateStaffIds) {
      const staff = await staffRepo.findById(staffId);
      if (staff && staff.isActive) {
        // Get active bookings count for workload calculation
        const bookingsRepo = getBookingsRepository();
        const activeBookings = await bookingsRepo.findByStaff(staffId, {
          status: 'in_progress'
        });
        
        candidates.push({
          staffId: staff.id,
          staffName: staff.fullName,
          staffPhoto: staff.photo,
          rating: staff.rating || 4.5,
          isOnline: true, // Can be enhanced with real availability
          activeBookings: activeBookings.length,
          maxConcurrentBookings: 3, // Can be configured per staff
          responseTime: '< 2 min', // Can be calculated from response history
        });
      }
    }
    
    if (candidates.length === 0) {
      return fallbackToManualAssignment(bookingId, 'No candidate staff available');
    }

    // Filter by online and available
    const available = candidates.filter(staff => 
      staff.isOnline && 
      staff.activeBookings < staff.maxConcurrentBookings
    );

    if (available.length === 0) {
      return fallbackToManualAssignment(bookingId, 'All doctors busy');
    }

    // Rank candidates
    const ranked = rankCandidates(available);
    const selected = ranked[0];

    // ✅ SQL: Assign to booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      console.error(`Booking ${bookingId} not found for assignment`);
      return;
    }

    const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
    await bookingsRepo.update(bookingId, {
      staff_id: selected.staffId,
      status: TELE_BOOKING_STATUS.ASSIGNED,
      notes: JSON.stringify({
        ...bookingNotes,
        assignedStaffId: selected.staffId,
        assignedStaffName: selected.staffName,
        assignedStaffPhoto: selected.staffPhoto,
        assignedAt: new Date().toISOString(),
        assignmentMethod: 'auto',
      }),
    });

    // ✅ SQL: Notify staff
    await notifyStaffOfAssignment(selected.staffId, bookingId);

    console.log(`✅ Auto-assigned: ${selected.staffName} to booking ${bookingId}`);

    return {
      success: true,
      assignedStaffId: selected.staffId,
      assignedStaffName: selected.staffName,
      assignmentMethod: 'auto'
    };

  } catch (error) {
    console.error('Error in auto-assignment:', error);
    return fallbackToManualAssignment(bookingId, 'System error during assignment');
  }
}

/**
 * Fallback to manual assignment
 */
async function fallbackToManualAssignment(bookingId: string, reason: string) {
  const bookingsRepo = getBookingsRepository();
  const booking = await bookingsRepo.findById(bookingId);
  if (!booking) {
    console.error(`Booking ${bookingId} not found for fallback`);
    return;
  }

  const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
  await bookingsRepo.update(bookingId, {
    status: 'manual_assignment_pending',
    notes: JSON.stringify({
      ...bookingNotes,
      assignmentMethod: 'manual_pending',
      fallbackReason: reason,
    }),
  });

  console.log(`⚠️ Fallback to manual assignment: ${reason}`);

  return {
    success: false,
    assignmentMethod: 'manual_pending',
    message: 'Your request has been accepted. We will assign a service provider shortly.',
    fallbackReason: reason,
    estimatedAssignmentTime: 'within 1 hour'
  };
}

/**
 * Rank candidates by rating, workload, response time
 */
function rankCandidates(candidates: any[]) {
  return candidates
    .map(staff => {
      let score = 0;

      // Rating: 50% weight (0-50 points)
      score += (staff.rating / 5) * 50;

      // Workload: 30% weight (0-30 points)
      const workloadScore = 30 * (1 - (staff.activeBookings / staff.maxConcurrentBookings));
      score += workloadScore;

      // Response Time: 20% weight (0-20 points)
      const responseMinutes = parseResponseTime(staff.responseTime);
      const responseScore = Math.max(0, 20 - (responseMinutes * 4));
      score += responseScore;

      return { ...staff, score };
    })
    .sort((a, b) => b.score - a.score);
}

function parseResponseTime(timeStr: string): number {
  const match = timeStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 5;
}

/**
 * Notify staff of assignment
 */
async function notifyStaffOfAssignment(staffId: string, bookingId: string) {
  try {
    const notificationsRepo = getNotificationsRepository();
    await notificationsRepo.create({
      user_id: staffId, // Assuming staff has a user_id
      notification_type: 'new_assignment',
      title: 'New Booking Assigned',
      message: 'You have been assigned to a new instant tele consultation',
      data: { bookingId },
    });
    console.log(`📬 Notification sent to staff ${staffId}`);
  } catch (error) {
    console.error(`Error sending notification to staff ${staffId}:`, error);
  }
}

/**
 * GET /bookings/:bookingId/status
 * Check booking status (for polling during assignment)
 */
app.get('/bookings/:bookingId/status', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');

    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return sendError(c, TELE_ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const response: any = {
      success: true,
      bookingId,
      status: booking.status
    };

    const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
    if (booking.status === TELE_BOOKING_STATUS.ASSIGNED && booking.staff_id) {
      // ✅ SQL: Get staff details
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findById(booking.staff_id);
      if (staff) {
        response.assignedDoctor = {
          id: booking.staff_id,
          name: bookingNotes.assignedStaffName || staff.fullName,
          photo: bookingNotes.assignedStaffPhoto || staff.photo,
          rating: staff.rating,
          specialization: staff.specialization,
        };
        response.sessionUrl = `https://video.warmpawz.com/session/${bookingId}`;
      }
    }

    return sendSuccess(c, response);

  } catch (error: any) {
    console.error('Error fetching booking status:', error);
    return sendError(c, error.message, 500);
  }
});

export default app;

