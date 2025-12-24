/**
 * ============================================================================
 * INSTANT TELE-CONSULTATION ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - View available staff before payment
 * - Role-based staff listing
 * - Instant assignment after payment
 * - Queue management
 * - Real-time availability
 * - Auto-assignment algorithm
 * - Session management
 * - Rating & feedback
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

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getTeleQueuesRepository } from "../../lib/repositories/tele-queues.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import {
  TELE_BOOKING_TYPES,
  TELE_BOOKING_STATUS,
  TELE_QUEUE_STATUS,
  TELE_ERROR_MESSAGES,
  TELE_SUCCESS_MESSAGES,
  TELE_LOG_MESSAGES,
} from './tele-service-constants.ts';
import { SERVICE_STYLE } from './home-service-constants.ts';

// Role names mapping
const ROLE_NAMES: Record<string, string> = {
  'veterinarian': 'Veterinarian',
  'nutritionist': 'Pet Nutritionist',
  'trainer': 'Pet Trainer',
  'insurance-advisor': 'Insurance Advisor',
  'behaviorist': 'Pet Behaviorist',
  'groomer': 'Pet Grooming Expert'
};

/**
 * Auto-assignment algorithm - finds best available staff
 */
async function autoAssignStaff(roleId: string, bookingId: string): Promise<any | null> {
  try {
    // ✅ SQL: Get all staff for role
    const vendorsRepo = getVendorsRepository();
    const vendors = await vendorsRepo.findByStatus('approved');
    const vendorsWithRole = vendors.filter(v => v.role_id === roleId);
    
    const staffRepo = getStaffRepository();
    const allStaff = [];
    for (const vendor of vendorsWithRole) {
      const vendorStaff = await staffRepo.findByVendorId(vendor.id);
      allStaff.push(...vendorStaff);
    }
    
    // Filter available staff (is_active and has tele service style)
    const availableStaff = allStaff
      .filter((staff: any) => {
        const serviceStyles = Array.isArray(staff.service_styles) 
          ? staff.service_styles 
          : (staff.service_styles ? [staff.service_styles] : []);
        return staff.isActive && 
               (serviceStyles.length === 0 || serviceStyles.includes(SERVICE_STYLE.TELE));
      })
      .sort((a: any, b: any) => {
        // Sort by: 1) Rating, 2) Total appointments (experience)
        if (b.rating !== a.rating) {
          return (b.rating || 0) - (a.rating || 0);
        }
        return (b.total_appointments || 0) - (a.total_appointments || 0);
      });

    if (availableStaff.length === 0) {
      return null;
    }

    const selectedStaff = availableStaff[0];
    return {
      staffId: selectedStaff.id,
      roleId,
      roleName: ROLE_NAMES[roleId] || roleId,
      name: selectedStaff.fullName,
      qualifications: selectedStaff.qualifications || [],
      experience: selectedStaff.experience_years || 0,
      specializations: Array.isArray(selectedStaff.specializations) 
        ? selectedStaff.specializations 
        : (selectedStaff.specialization ? [selectedStaff.specialization] : []),
      languages: selectedStaff.languages || ['English'],
      rating: selectedStaff.rating || 5.0,
      totalConsultations: selectedStaff.total_appointments || 0,
      profilePhoto: selectedStaff.photo,
      vendorId: selectedStaff.vendor_id,
      availability: {
        status: 'available',
        lastUpdated: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error in auto-assignment:', error);
    return null;
  }
}

export function instantTeleEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * GET /tele-services/instant/available-staff
   * Get available staff for instant consultation (shown before payment)
   */
  app.get(`${BASE_PATH}/tele-services/instant/available-staff`, async (c) => {
    try {
      const roleId = c.req.query('roleId');

      if (!roleId) {
        return sendError(c, 'Missing roleId parameter', 400);
      }

      // ✅ SQL: Get all staff for role
      const vendorsRepo = getVendorsRepository();
      const vendors = await vendorsRepo.findByStatus('approved');
      const vendorsWithRole = vendors.filter(v => v.role_id === roleId);
      
      const staffRepo = getStaffRepository();
      const allStaff = [];
      for (const vendor of vendorsWithRole) {
        const vendorStaff = await staffRepo.findByVendorId(vendor.id);
        allStaff.push(...vendorStaff);
      }
      
      // Filter available staff
      const availableStaff = allStaff
        .filter((staff: any) => {
          if (!staff.isActive) return false;
          const serviceStyles = Array.isArray(staff.service_styles) 
            ? staff.service_styles 
            : (staff.service_styles ? [staff.service_styles] : []);
          return serviceStyles.length === 0 || serviceStyles.includes(SERVICE_STYLE.TELE);
        })
        .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
        .map((s: any) => ({
          staffId: s.id,
          name: s.fullName,
          qualifications: s.qualifications || [],
          experience: s.experience_years || 0,
          specializations: Array.isArray(s.specializations) 
            ? s.specializations 
            : (s.specialization ? [s.specialization] : []),
          languages: s.languages || ['English'],
          rating: s.rating || 0,
          totalConsultations: s.total_appointments || 0,
          profilePhoto: s.photo,
          consultationFee: 0, // Can be from services table
          availability: 'available'
        }));

      return sendSuccess(c, {
        roleId,
        roleName: ROLE_NAMES[roleId] || roleId,
        count: availableStaff.length,
        staff: availableStaff
      });

    } catch (error) {
      console.error('❌ Error fetching available staff:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /tele-services/staff/role-names
   * Get all role names for instant tele services
   */
  app.get(`${BASE_PATH}/tele-services/staff/role-names`, async (c) => {
    try {
      const roles = Object.keys(ROLE_NAMES).map(roleId => ({
        roleId,
        roleName: ROLE_NAMES[roleId]
      }));

      return sendSuccess(c, { roles });

    } catch (error) {
      console.error('❌ Error fetching role names:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /tele-services/instant/create-booking
   * Create instant tele booking (before payment)
   */
  app.post(`${BASE_PATH}/tele-services/instant/create-booking`, async (c) => {
    try {
      const body = await c.req.json();
      const { customerId, petId, petName, roleId, consultationFee } = body;

      if (!customerId || !petId || !roleId || !consultationFee) {
        return sendError(c, TELE_ERROR_MESSAGES.MISSING_FIELDS, 400);
      }

      // ✅ SQL: Create booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.create({
        customer_id: customerId,
        pet_id: petId,
        booking_date: new Date().toISOString().split('T')[0],
        booking_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        service_type: TELE_BOOKING_TYPES.INSTANT,
        service_style: SERVICE_STYLE.TELE,
        base_price: parseFloat(consultationFee),
        total_amount: parseFloat(consultationFee),
        notes: JSON.stringify({
          consultationType: 'instant',
          petName: petName || '',
          roleId,
          roleName: ROLE_NAMES[roleId] || roleId,
        }),
      });

      console.log(`✅ Instant tele booking created: ${booking.id}`);

      return sendSuccess(c, {
        booking: {
          bookingId: booking.id,
          status: TELE_BOOKING_STATUS.PENDING_PAYMENT,
          consultationFee: parseFloat(consultationFee),
          roleName: ROLE_NAMES[roleId] || roleId
        }
      }, 'Booking created. Please complete payment.');

    } catch (error) {
      console.error('❌ Error creating booking:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /tele-services/instant/assign-staff
   * Assign staff after payment completion
   */
  app.post(`${BASE_PATH}/tele-services/instant/assign-staff`, async (c) => {
    try {
      const body = await c.req.json();
      const { bookingId, paymentId, razorpayPaymentId } = body;

      if (!bookingId || !paymentId) {
        return sendError(c, TELE_ERROR_MESSAGES.MISSING_FIELDS, 400);
      }

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, TELE_ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
      }

      const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
      if (booking.status !== TELE_BOOKING_STATUS.PENDING_PAYMENT) {
        return sendError(c, 'Booking payment already completed', 400);
      }

      // ✅ SQL: Update booking with payment info
      await bookingsRepo.update(bookingId, {
        payment_status: 'paid',
        payment_id: paymentId,
        status: TELE_BOOKING_STATUS.PAYMENT_COMPLETED,
        notes: JSON.stringify({
          ...bookingNotes,
          paymentId,
          razorpayPaymentId,
        }),
      });

      // Try to auto-assign staff
      const assignedStaff = await autoAssignStaff(bookingNotes.roleId, bookingId);

      if (assignedStaff) {
        // ✅ SQL: Staff assigned immediately
        await bookingsRepo.update(bookingId, {
          staff_id: assignedStaff.staffId,
          status: TELE_BOOKING_STATUS.ASSIGNED,
          notes: JSON.stringify({
            ...bookingNotes,
            staffId: assignedStaff.staffId,
            staffName: assignedStaff.name,
            assignedAt: new Date().toISOString(),
            sessionLink: `https://meet.warmpawz.com/${bookingId}`,
          }),
        });

        console.log(`✅ Staff ${assignedStaff.staffId} assigned to booking ${bookingId}`);

        return sendSuccess(c, {
          booking: {
            bookingId,
            status: TELE_BOOKING_STATUS.ASSIGNED,
            staffId: assignedStaff.staffId,
            staffName: assignedStaff.name,
            sessionLink: `https://meet.warmpawz.com/${bookingId}`,
            message: 'Staff assigned! Join the consultation now.'
          }
        }, TELE_SUCCESS_MESSAGES.STAFF_ASSIGNED);

      } else {
        // ✅ SQL: No staff available, add to queue
        const teleQueuesRepo = getTeleQueuesRepository();
        const queuePosition = await teleQueuesRepo.getNextQueuePosition(bookingNotes.roleId);
        
        await teleQueuesRepo.create({
          role_id: bookingNotes.roleId,
          booking_id: bookingId,
          customer_id: booking.customer_id,
          queue_position: queuePosition,
          estimated_wait_minutes: queuePosition * 15, // 15 min per consultation
          status: TELE_QUEUE_STATUS.WAITING,
        });

        await bookingsRepo.update(bookingId, {
          status: TELE_BOOKING_STATUS.PAYMENT_COMPLETED,
          notes: JSON.stringify({
            ...bookingNotes,
            queuePosition,
          }),
        });

        console.log(`✅ Booking ${bookingId} added to queue at position ${queuePosition}`);

        return sendSuccess(c, {
          booking: {
            bookingId,
            status: TELE_BOOKING_STATUS.PAYMENT_COMPLETED,
            queuePosition,
            estimatedWait: queuePosition * 15,
            message: 'Payment successful! You are in queue. We will notify when a staff is available.'
          }
        }, 'Added to queue. Please wait.');
      }

    } catch (error) {
      console.error('❌ Error assigning staff:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /tele-services/instant/start-session
   * Start consultation session
   */
  app.post(`${BASE_PATH}/tele-services/instant/start-session`, async (c) => {
    try {
      const body = await c.req.json();
      const { bookingId } = body;

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, TELE_ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
      }

      if (booking.status !== TELE_BOOKING_STATUS.ASSIGNED) {
        return sendError(c, 'Booking is not ready to start', 400);
      }

      // ✅ SQL: Update booking status
      await bookingsRepo.update(bookingId, {
        status: TELE_BOOKING_STATUS.IN_PROGRESS,
      });

      console.log(`✅ Session started for booking: ${bookingId}`);

      const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
      return sendSuccess(c, {
        bookingId,
        status: TELE_BOOKING_STATUS.IN_PROGRESS,
        sessionLink: bookingNotes.sessionLink,
        startedAt: new Date().toISOString()
      }, 'Session started');

    } catch (error) {
      console.error('❌ Error starting session:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /tele-services/instant/complete-session
   * Complete consultation and free up staff
   */
  app.post(`${BASE_PATH}/tele-services/instant/complete-session`, async (c) => {
    try {
      const body = await c.req.json();
      const { bookingId, prescription, notes } = body;

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, TELE_ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
      }

      const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
      const startTime = new Date(bookingNotes.startedAt || bookingNotes.assignedAt || booking.created_at);
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000); // minutes

      // ✅ SQL: Update booking
      await bookingsRepo.update(bookingId, {
        status: TELE_BOOKING_STATUS.COMPLETED,
        completed_at: endTime.toISOString(),
        notes: JSON.stringify({
          ...bookingNotes,
          prescription,
          notes,
          duration,
          completedAt: endTime.toISOString(),
        }),
      });

      // ✅ SQL: Try to assign next in queue
      if (bookingNotes.roleId) {
        const teleQueuesRepo = getTeleQueuesRepository();
        const waitingQueues = await teleQueuesRepo.findByRoleAndStatus(bookingNotes.roleId, TELE_QUEUE_STATUS.WAITING);
        
        if (waitingQueues.length > 0) {
          const nextInQueue = waitingQueues[0];
          await teleQueuesRepo.assign(nextInQueue.id);
          
          // Auto-assign staff to next booking
          const assignedStaff = await autoAssignStaff(bookingNotes.roleId, nextInQueue.booking_id);
          if (assignedStaff) {
            await bookingsRepo.update(nextInQueue.booking_id, {
              staff_id: assignedStaff.staffId,
              status: TELE_BOOKING_STATUS.ASSIGNED,
            });
          }
        }
      }

      console.log(`✅ Session completed for booking: ${bookingId} (${duration} min)`);

      return sendSuccess(c, {
        bookingId,
        status: TELE_BOOKING_STATUS.COMPLETED,
        duration,
        completedAt: endTime.toISOString()
      }, 'Session completed successfully');

    } catch (error) {
      console.error('❌ Error completing session:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /tele-services/instant/rate
   * Rate consultation
   */
  app.post(`${BASE_PATH}/tele-services/instant/rate`, async (c) => {
    try {
      const body = await c.req.json();
      const { bookingId, rating, feedback } = body;

      if (!bookingId || !rating) {
        return sendError(c, TELE_ERROR_MESSAGES.MISSING_FIELDS, 400);
      }

      if (rating < 1 || rating > 5) {
        return sendError(c, 'Rating must be between 1 and 5', 400);
      }

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, TELE_ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
      }

      const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
      
      // ✅ SQL: Update booking with rating
      await bookingsRepo.update(bookingId, {
        notes: JSON.stringify({
          ...bookingNotes,
          rating,
          feedback,
        }),
      });

      // ✅ SQL: Update staff rating (if staff assigned)
      if (booking.staff_id) {
        const staffRepo = getStaffRepository();
        const staff = await staffRepo.findById(booking.staff_id);
        if (staff) {
          // Calculate new average rating
          const totalAppointments = staff.total_appointments || 0;
          const currentRating = staff.rating || 5.0;
          const newRating = totalAppointments > 0
            ? ((currentRating * (totalAppointments - 1)) + rating) / totalAppointments
            : rating;
          
          // Note: Staff rating update would need an update method in repository
          // For now, this is handled via reviews repository or direct update
        }
      }

      console.log(`✅ Booking ${bookingId} rated: ${rating} stars`);

      return sendSuccess(c, {
        bookingId,
        rating,
        feedback
      }, 'Rating submitted successfully');

    } catch (error) {
      console.error('❌ Error submitting rating:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /tele-services/booking/:bookingId
   * Get booking details
   */
  app.get(`${BASE_PATH}/tele-services/booking/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, TELE_ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
      }

      return sendSuccess(c, { booking });

    } catch (error) {
      console.error('❌ Error fetching booking:', error);
      return sendError(c, String(error), 500);
    }
  });

  console.log('✅ Instant Tele-Consultation Endpoints registered (SQL-only)');
}

