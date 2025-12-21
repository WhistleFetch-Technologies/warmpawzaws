import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 📞 INSTANT TELE-CONSULTATION ENDPOINTS
 * 
 * Complete instant tele-consultation system with real-time staff assignment
 * 
 * Features:
 * - View available staff before payment
 * - Role-based staff listing (Vets, Nutritionists, Trainers, Insurance Advisors)
 * - Instant assignment after payment
 * - Queue management
 * - Real-time availability
 * - Auto-assignment algorithm
 * - Session management
 * - Rating & feedback
 */

interface StaffMember {
  staffId: string;
  roleId: string;
  roleName: string;
  name: string;
  qualifications: string[];
  experience: number; // years
  specializations: string[];
  languages: string[];
  rating: number;
  totalConsultations: number;
  profilePhoto?: string;
  availability: {
    status: 'available' | 'busy' | 'offline';
    lastUpdated: string;
  };
  pricing: {
    consultationFee: number;
    currency: string;
  };
  vendorId: string;
}

interface InstantTeleBooking {
  bookingId: string;
  customerId: string;
  petId: string;
  petName: string;
  roleId: string;
  roleName: string;
  staffId?: string;
  staffName?: string;
  consultationType: 'instant';
  status: 'pending_payment' | 'payment_completed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  consultationFee: number;
  paymentId?: string;
  razorpayPaymentId?: string;
  queuePosition?: number;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number; // in minutes
  sessionLink?: string; // Video call link
  prescription?: string;
  notes?: string;
  rating?: number;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
}

interface TeleQueue {
  queueId: string;
  roleId: string;
  bookings: Array<{
    bookingId: string;
    customerId: string;
    petName: string;
    priority: number;
    waitingTime: number; // in minutes
    joinedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// Get staff role names
const ROLE_NAMES: Record<string, string> = {
  'veterinarian': 'Veterinarian',
  'nutritionist': 'Pet Nutritionist',
  'trainer': 'Pet Trainer',
  'insurance-advisor': 'Insurance Advisor',
  'behaviorist': 'Pet Behaviorist',
  'groomer': 'Pet Grooming Expert'
};

// Auto-assignment algorithm - finds best available staff
async function autoAssignStaff(kv: any, roleId: string, bookingId: string): Promise<StaffMember | null> {
  try {
    // Get all staff for role
    const allStaff = await kv.getByPrefix('tele:staff:') || [];
    
    const availableStaff = allStaff
      .map((item: any) => item.value || item)
      .filter((staff: any) => 
        staff.roleId === roleId && 
        staff.availability.status === 'available'
      )
      .sort((a: any, b: any) => {
        // Sort by: 1) Rating, 2) Total consultations (experience)
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        return b.totalConsultations - a.totalConsultations;
      });

    if (availableStaff.length === 0) {
      return null;
    }

    const selectedStaff = availableStaff[0];

    // Mark staff as busy
    selectedStaff.availability.status = 'busy';
    selectedStaff.availability.lastUpdated = new Date().toISOString();
    await kv.set(`tele:staff:${selectedStaff.staffId}`, selectedStaff);

    return selectedStaff;
  } catch (error) {
    console.error('Error in auto-assignment:', error);
    return null;
  }
}

export function instantTeleEndpoints(app: Hono, kv: any) {
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

      const allStaff = await kv.getByPrefix('tele:staff:') || [];
      
      const availableStaff = allStaff
        .map((item: any) => item.value || item)
        .filter((staff: any) => 
          staff.roleId === roleId && 
          staff.availability.status === 'available'
        )
        .sort((a: any, b: any) => b.rating - a.rating);

      return sendSuccess(c, {
        roleId,
        roleName: ROLE_NAMES[roleId] || roleId,
        count: availableStaff.length,
        staff: availableStaff.map((s: any) => ({
          staffId: s.staffId,
          name: s.name,
          qualifications: s.qualifications,
          experience: s.experience,
          specializations: s.specializations,
          languages: s.languages,
          rating: s.rating,
          totalConsultations: s.totalConsultations,
          profilePhoto: s.profilePhoto,
          consultationFee: s.pricing.consultationFee,
          availability: s.availability.status
        }))
      });

    } catch (error) {
      console.error('❌ Error fetching available staff:', error);
      return sendError(c, error, 500);
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
      return sendError(c, error, 500);
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
        return sendError(c, 'Missing required fields', 400);
      }

      const bookingId = `TELE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const booking: InstantTeleBooking = {
        bookingId,
        customerId,
        petId,
        petName: petName || '',
        roleId,
        roleName: ROLE_NAMES[roleId] || roleId,
        consultationType: 'instant',
        status: 'pending_payment',
        consultationFee,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`tele:booking:${bookingId}`, booking);

      console.log(`✅ Instant tele booking created: ${bookingId}`);

      return sendSuccess(c, {
        booking: {
          bookingId,
          status: 'pending_payment',
          consultationFee,
          roleName: booking.roleName
        }
      }, 'Booking created. Please complete payment.');

    } catch (error) {
      console.error('❌ Error creating booking:', error);
      return sendError(c, error, 500);
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
        return sendError(c, 'Missing required fields', 400);
      }

      const booking = await kv.get(`tele:booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.status !== 'pending_payment') {
        return sendError(c, 'Booking payment already completed', 400);
      }

      // Update booking with payment info
      booking.paymentId = paymentId;
      booking.razorpayPaymentId = razorpayPaymentId;
      booking.status = 'payment_completed';
      booking.updatedAt = new Date().toISOString();

      // Try to auto-assign staff
      const assignedStaff = await autoAssignStaff(kv, booking.roleId, bookingId);

      if (assignedStaff) {
        // Staff assigned immediately
        booking.staffId = assignedStaff.staffId;
        booking.staffName = assignedStaff.name;
        booking.status = 'assigned';
        booking.assignedAt = new Date().toISOString();
        
        // Generate session link (in production, integrate with video call service)
        booking.sessionLink = `https://meet.warmpawz.com/${bookingId}`;

        await kv.set(`tele:booking:${bookingId}`, booking);

        console.log(`✅ Staff ${assignedStaff.staffId} assigned to booking ${bookingId}`);

        return sendSuccess(c, {
          booking: {
            bookingId,
            status: 'assigned',
            staffId: assignedStaff.staffId,
            staffName: assignedStaff.name,
            sessionLink: booking.sessionLink,
            message: 'Staff assigned! Join the consultation now.'
          }
        }, 'Staff assigned successfully');

      } else {
        // No staff available, add to queue
        const queueId = `QUEUE-${booking.roleId}`;
        let queue = await kv.get(`tele:queue:${queueId}`);

        if (!queue) {
          queue = {
            queueId,
            roleId: booking.roleId,
            bookings: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }

        const queuePosition = queue.bookings.length + 1;

        queue.bookings.push({
          bookingId,
          customerId: booking.customerId,
          petName: booking.petName,
          priority: 1,
          waitingTime: 0,
          joinedAt: new Date().toISOString()
        });

        queue.updatedAt = new Date().toISOString();

        await kv.set(`tele:queue:${queueId}`, queue);

        booking.queuePosition = queuePosition;
        await kv.set(`tele:booking:${bookingId}`, booking);

        console.log(`✅ Booking ${bookingId} added to queue at position ${queuePosition}`);

        return sendSuccess(c, {
          booking: {
            bookingId,
            status: 'payment_completed',
            queuePosition,
            estimatedWait: queuePosition * 15, // 15 min per consultation
            message: 'Payment successful! You are in queue. We will notify when a staff is available.'
          }
        }, 'Added to queue. Please wait.');
      }

    } catch (error) {
      console.error('❌ Error assigning staff:', error);
      return sendError(c, error, 500);
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

      const booking = await kv.get(`tele:booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.status !== 'assigned') {
        return sendError(c, 'Booking is not ready to start', 400);
      }

      booking.status = 'in_progress';
      booking.startedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();

      await kv.set(`tele:booking:${bookingId}`, booking);

      console.log(`✅ Session started for booking: ${bookingId}`);

      return sendSuccess(c, {
        bookingId,
        status: 'in_progress',
        sessionLink: booking.sessionLink,
        startedAt: booking.startedAt
      }, 'Session started');

    } catch (error) {
      console.error('❌ Error starting session:', error);
      return sendError(c, error, 500);
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

      const booking = await kv.get(`tele:booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const startTime = new Date(booking.startedAt || booking.assignedAt);
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000); // minutes

      booking.status = 'completed';
      booking.completedAt = endTime.toISOString();
      booking.duration = duration;
      booking.prescription = prescription;
      booking.notes = notes;
      booking.updatedAt = endTime.toISOString();

      await kv.set(`tele:booking:${bookingId}`, booking);

      // Free up staff
      if (booking.staffId) {
        const staff = await kv.get(`tele:staff:${booking.staffId}`);
        if (staff) {
          staff.availability.status = 'available';
          staff.availability.lastUpdated = endTime.toISOString();
          staff.totalConsultations = (staff.totalConsultations || 0) + 1;
          await kv.set(`tele:staff:${booking.staffId}`, staff);

          // Try to assign next in queue
          const queueId = `QUEUE-${booking.roleId}`;
          const queue = await kv.get(`tele:queue:${queueId}`);

          if (queue && queue.bookings.length > 0) {
            const nextBooking = queue.bookings.shift();
            queue.updatedAt = new Date().toISOString();
            await kv.set(`tele:queue:${queueId}`, queue);

            // Auto-assign to next in queue
            await autoAssignStaff(kv, booking.roleId, nextBooking.bookingId);
          }
        }
      }

      console.log(`✅ Session completed for booking: ${bookingId} (${duration} min)`);

      return sendSuccess(c, {
        bookingId,
        status: 'completed',
        duration,
        completedAt: booking.completedAt
      }, 'Session completed successfully');

    } catch (error) {
      console.error('❌ Error completing session:', error);
      return sendError(c, error, 500);
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
        return sendError(c, 'Missing required fields', 400);
      }

      if (rating < 1 || rating > 5) {
        return sendError(c, 'Rating must be between 1 and 5', 400);
      }

      const booking = await kv.get(`tele:booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      booking.rating = rating;
      booking.feedback = feedback;
      booking.updatedAt = new Date().toISOString();

      await kv.set(`tele:booking:${bookingId}`, booking);

      // Update staff rating
      if (booking.staffId) {
        const staff = await kv.get(`tele:staff:${booking.staffId}`);
        if (staff) {
          const totalRating = (staff.rating * (staff.totalConsultations - 1) + rating) / staff.totalConsultations;
          staff.rating = parseFloat(totalRating.toFixed(1));
          await kv.set(`tele:staff:${booking.staffId}`, staff);
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
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /tele-services/booking/:bookingId
   * Get booking details
   */
  app.get(`${BASE_PATH}/tele-services/booking/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      const booking = await kv.get(`tele:booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      return sendSuccess(c, { booking });

    } catch (error) {
      console.error('❌ Error fetching booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /tele-services/staff/register
   * Register staff member for instant tele consultations
   */
  app.post(`${BASE_PATH}/tele-services/staff/register`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        roleId,
        name,
        qualifications,
        experience,
        specializations,
        languages,
        consultationFee,
        profilePhoto
      } = body;

      if (!vendorId || !roleId || !name || !consultationFee) {
        return sendError(c, 'Missing required fields', 400);
      }

      const staffId = `STAFF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const staff: StaffMember = {
        staffId,
        roleId,
        roleName: ROLE_NAMES[roleId] || roleId,
        name,
        qualifications: qualifications || [],
        experience: experience || 0,
        specializations: specializations || [],
        languages: languages || ['English'],
        rating: 5.0,
        totalConsultations: 0,
        profilePhoto,
        availability: {
          status: 'available',
          lastUpdated: new Date().toISOString()
        },
        pricing: {
          consultationFee,
          currency: 'INR'
        },
        vendorId
      };

      await kv.set(`tele:staff:${staffId}`, staff);

      console.log(`✅ Staff registered: ${staffId}`);

      return sendSuccess(c, { staff }, 'Staff registered successfully');

    } catch (error) {
      console.error('❌ Error registering staff:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /tele-services/staff/:staffId/availability
   * Update staff availability
   */
  app.post(`${BASE_PATH}/tele-services/staff/:staffId/availability`, async (c) => {
    try {
      const { staffId } = c.req.param();
      const body = await c.req.json();
      const { status } = body;

      const validStatuses = ['available', 'busy', 'offline'];
      
      if (!status || !validStatuses.includes(status)) {
        return sendError(c, 'Invalid status', 400);
      }

      const staff = await kv.get(`tele:staff:${staffId}`);
      
      if (!staff) {
        return sendError(c, 'Staff not found', 404);
      }

      staff.availability.status = status;
      staff.availability.lastUpdated = new Date().toISOString();

      await kv.set(`tele:staff:${staffId}`, staff);

      console.log(`✅ Staff ${staffId} availability updated to: ${status}`);

      return sendSuccess(c, {
        staffId,
        availability: staff.availability
      }, 'Availability updated successfully');

    } catch (error) {
      console.error('❌ Error updating availability:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Instant Tele-Consultation Endpoints registered');
}
