/**
 * CRITICAL MISSING FEATURE: Instant Tele Booking
 * 
 * Implements payment-first flow with auto-assignment after payment
 */

import { Hono } from 'hono';
import { cors } from "hono/cors";
import * as kv from './kv_store';

const app = new Hono();
app.use('*', cors());

/**
 * POST /bookings/instant-tele
 * Create instant tele booking (payment-first)
 * 
 * Status: ❌ PREVIOUSLY MISSING → ✅ NOW IMPLEMENTED
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
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Create booking with pending_payment status
    const bookingId = `booking_instant_tele_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const booking = {
      id: bookingId,
      type: 'instant_tele',
      customerId,
      petId,
      serviceId,
      serviceName,
      status: 'pending_payment',
      candidateDoctorIds,
      amount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kv.set(`booking:${bookingId}`, booking);

    console.log(`✅ Created instant tele booking: ${bookingId}`);

    return c.json({
      success: true,
      bookingId,
      status: 'pending_payment',
      candidateDoctors: await loadCandidateDoctorDetails(candidateDoctorIds),
      amount,
      createdAt: booking.createdAt
    });

  } catch (error: any) {
    console.error('Error creating instant tele booking:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /payments/process-instant-tele
 * Process payment and trigger auto-assignment
 */
app.post('/payments/process-instant-tele', async (c) => {
  try {
    const { bookingId, amount, paymentMethod, paymentId } = await c.req.json();

    // Get booking
    const bookingData = await kv.get(`booking:${bookingId}`);
    if (!bookingData || !bookingData.value) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookingData.value;

    // Update booking with payment info
    booking.status = 'awaiting_assignment';
    booking.paymentId = paymentId;
    booking.paymentMethod = paymentMethod;
    booking.paidAt = new Date().toISOString();
    await kv.set(`booking:${bookingId}`, booking);

    console.log(`💳 Payment processed for booking: ${bookingId}`);

    // TRIGGER AUTO-ASSIGNMENT (async)
    // In production, this would be a background job/webhook
    setTimeout(() => autoAssignInstantTele(bookingId, booking.candidateDoctorIds), 1000);

    return c.json({
      success: true,
      bookingId,
      status: 'awaiting_assignment',
      message: 'Payment successful. Assigning doctor...'
    });

  } catch (error: any) {
    console.error('Error processing payment:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /assignments/auto-assign-instant-tele
 * Auto-assign doctor from candidate pool
 * 
 * Status: ❌ PREVIOUSLY MISSING → ✅ NOW IMPLEMENTED
 */
async function autoAssignInstantTele(bookingId: string, candidateStaffIds: string[]) {
  try {
    console.log(`🔍 Starting auto-assignment for booking: ${bookingId}`);

    // Load candidates
    const candidates = await loadStaffDetails(candidateStaffIds);
    
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

    // Assign to booking
    const bookingData = await kv.get(`booking:${bookingId}`);
    const booking = bookingData.value;
    
    booking.assignedStaffId = selected.staffId;
    booking.assignedStaffName = selected.staffName;
    booking.assignedStaffPhoto = selected.staffPhoto;
    booking.status = 'assigned';
    booking.assignedAt = new Date().toISOString();
    booking.assignmentMethod = 'auto';

    await kv.set(`booking:${bookingId}`, booking);

    // Update staff active bookings
    await incrementStaffActiveBookings(selected.staffId);

    // Notify staff
    await notifyStaffOfAssignment(selected.staffId, bookingId);

    console.log(`✅ Auto-assigned: Dr. ${selected.staffName} to booking ${bookingId}`);

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
  const bookingData = await kv.get(`booking:${bookingId}`);
  const booking = bookingData.value;

  booking.status = 'manual_assignment_pending';
  booking.assignmentMethod = 'manual_pending';
  booking.fallbackReason = reason;
  await kv.set(`booking:${bookingId}`, booking);

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
 * Load staff details
 */
async function loadStaffDetails(staffIds: string[]) {
  const staff = [];

  for (const staffId of staffIds) {
    try {
      const profileData = await kv.get(`staff:${staffId}:profile`);
      const availabilityData = await kv.get(`staff:${staffId}:availability:current`);

      if (profileData && profileData.value) {
        staff.push({
          staffId,
          staffName: profileData.value.fullName,
          staffPhoto: profileData.value.photo,
          rating: profileData.value.rating || 4.5,
          isOnline: availabilityData?.value?.isOnline || false,
          activeBookings: availabilityData?.value?.activeBookings || 0,
          maxConcurrentBookings: availabilityData?.value?.maxConcurrentBookings || 3,
          responseTime: profileData.value.responseTime || '< 2 min'
        });
      }
    } catch (error) {
      console.error(`Error loading staff ${staffId}:`, error);
    }
  }

  return staff;
}

/**
 * Load candidate doctor details for response
 */
async function loadCandidateDoctorDetails(doctorIds: string[]) {
  const doctors = [];

  for (const doctorId of doctorIds) {
    try {
      const data = await kv.get(`staff:${doctorId}:profile`);
      if (data && data.value) {
        doctors.push({
          id: doctorId,
          name: data.value.fullName,
          rating: data.value.rating || 4.5,
          isOnline: true // Simplified - would check real status
        });
      }
    } catch (error) {
      console.error(`Error loading doctor ${doctorId}:`, error);
    }
  }

  return doctors;
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

async function incrementStaffActiveBookings(staffId: string) {
  const data = await kv.get(`staff:${staffId}:availability:current`);
  if (data && data.value) {
    const availability = data.value;
    availability.activeBookings = (availability.activeBookings || 0) + 1;
    await kv.set(`staff:${staffId}:availability:current`, availability);
  }
}

async function notifyStaffOfAssignment(staffId: string, bookingId: string) {
  const notification = {
    id: `notification_${Date.now()}`,
    staffId,
    bookingId,
    type: 'new_assignment',
    title: 'New Booking Assigned',
    message: 'You have been assigned to a new instant tele consultation',
    createdAt: new Date().toISOString(),
    read: false
  };

  await kv.set(`notification:${notification.id}`, notification);
  console.log(`📬 Notification sent to staff ${staffId}`);
}

/**
 * GET /bookings/:bookingId/status
 * Check booking status (for polling during assignment)
 */
app.get('/bookings/:bookingId/status', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');

    const bookingData = await kv.get(`booking:${bookingId}`);
    if (!bookingData || !bookingData.value) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookingData.value;

    const response: any = {
      success: true,
      bookingId,
      status: booking.status
    };

    if (booking.status === 'assigned' && booking.assignedStaffId) {
      const staffData = await kv.get(`staff:${booking.assignedStaffId}:profile`);
      response.assignedDoctor = {
        id: booking.assignedStaffId,
        name: booking.assignedStaffName,
        photo: booking.assignedStaffPhoto,
        ...staffData?.value
      };
      response.sessionUrl = `https://video.warmpawz.com/session/${bookingId}`;
    }

    return c.json(response);

  } catch (error: any) {
    console.error('Error fetching booking status:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
