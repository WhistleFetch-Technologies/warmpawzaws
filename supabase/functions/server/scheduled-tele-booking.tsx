/**
 * CRITICAL MISSING FEATURE: Scheduled Tele Booking
 * 
 * Implements calendar-based booking with pre-assigned consultant
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

const app = new Hono();
app.use('*', cors());

/**
 * GET /tele/scheduled-availability
 * Get tele availability from staff schedules
 * 
 * Status: ❌ PREVIOUSLY MISSING → ✅ NOW IMPLEMENTED
 */
app.get('/tele/scheduled-availability', async (c) => {
  try {
    const serviceId = c.req.query('serviceId');
    const date = c.req.query('date');

    if (!serviceId || !date) {
      return c.json({ error: 'serviceId and date are required' }, 400);
    }

    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    // Get staff who offer this service
    const serviceData = await kv.get(`service:${serviceId}`);
    if (!serviceData || !serviceData.value) {
      return c.json({ error: 'Service not found' }, 404);
    }

    const service = serviceData.value;
    const staffIds = service.assignedStaffIds || [];

    const availability = [];

    // Load availability for each staff member
    for (const staffId of staffIds) {
      const staffProfile = await kv.get(`staff:${staffId}:profile`);
      if (!staffProfile || !staffProfile.value) continue;

      const profile = staffProfile.value;

      // Get availability slots for this day
      const slotsData = await kv.getByPrefix(`staff:${staffId}:availability:`);
      const daySlots = slotsData
        .filter((item: any) => item.value && item.value.dayOfWeek === dayOfWeek && item.value.isActive)
        .filter((item: any) => item.value.hasTeleServices || item.value.allowedServiceIds?.includes(serviceId))
        .map((item: any) => item.value);

      if (daySlots.length === 0) continue;

      // Generate time slots from availability windows
      const timeSlots = await generateTimeSlots(daySlots, staffId, date);

      availability.push({
        staffId,
        staffName: profile.fullName,
        staffPhoto: profile.photo,
        specialization: profile.specialization || 'Veterinarian',
        rating: profile.rating || 4.5,
        reviewCount: profile.reviewCount || 0,
        experience: profile.experience || 0,
        languages: profile.languages || ['English'],
        slots: timeSlots
      });
    }

    return c.json({
      success: true,
      date,
      dayOfWeek,
      availability,
      totalStaff: availability.length,
      totalSlots: availability.reduce((sum, staff) => sum + staff.slots.length, 0),
      availableSlots: availability.reduce((sum, staff) => 
        sum + staff.slots.filter(s => s.available).length, 0
      )
    });

  } catch (error: any) {
    console.error('Error fetching tele availability:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /bookings/scheduled-tele
 * Create scheduled tele booking with pre-assigned consultant
 * 
 * Status: ❌ PREVIOUSLY MISSING → ✅ NOW IMPLEMENTED
 */
app.post('/bookings/scheduled-tele', async (c) => {
  try {
    const body = await c.req.json();
    const {
      serviceId,
      serviceName,
      staffId,
      staffName,
      slotId,
      scheduledDate,
      scheduledTime,
      duration,
      amount,
      customerId,
      petId
    } = body;

    // Validation
    if (!serviceId || !staffId || !slotId || !scheduledDate || !scheduledTime) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Check slot availability
    const slotKey = `booking:slot:${slotId}:${scheduledDate}`;
    const existingBooking = await kv.get(slotKey);
    
    if (existingBooking && existingBooking.value) {
      // Slot already booked - return 409 conflict
      const suggestedSlots = await findAlternativeSlots(staffId, scheduledDate);
      
      return c.json({
        error: 'Slot conflict',
        message: 'This slot was just booked by another customer',
        conflictDetails: {
          slotId,
          bookedAt: existingBooking.value.bookedAt,
          staffId
        },
        suggestedSlots
      }, 409);
    }

    // Create booking
    const bookingId = `booking_scheduled_tele_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const booking = {
      id: bookingId,
      type: 'scheduled_tele',
      customerId,
      petId,
      serviceId,
      serviceName,
      bookingType: 'scheduled_tele',
      status: 'confirmed',
      
      // Pre-assigned consultant
      assignedStaffId: staffId,
      assignedStaffName: staffName,
      assignmentMethod: 'scheduled',
      assignedAt: new Date().toISOString(),
      
      scheduledDate,
      scheduledTime,
      scheduledEndTime: calculateEndTime(scheduledTime, duration),
      duration,
      
      amount,
      currency: 'INR',
      paymentStatus: 'pending',
      
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Reserve the slot
    await kv.set(slotKey, {
      bookingId,
      customerId,
      bookedAt: new Date().toISOString()
    });

    // Save booking
    await kv.set(`booking:${bookingId}`, booking);

    console.log(`✅ Created scheduled tele booking: ${bookingId} with pre-assigned staff: ${staffId}`);

    // Get staff details for response
    const staffData = await kv.get(`staff:${staffId}:profile`);
    const staffProfile = staffData?.value || {};

    return c.json({
      success: true,
      bookingId,
      message: 'Booking created successfully',
      booking: {
        ...booking,
        assignedStaffPhoto: staffProfile.photo,
        assignedStaffSpecialization: staffProfile.specialization
      },
      paymentRequired: true,
      paymentUrl: `https://payment.warmpawz.com/checkout/${bookingId}`
    });

  } catch (error: any) {
    console.error('Error creating scheduled tele booking:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Generate time slots from availability windows
 */
async function generateTimeSlots(daySlots: any[], staffId: string, date: string) {
  const slots = [];

  for (const window of daySlots) {
    const start = parseTime(window.startTime);
    const end = parseTime(window.endTime);
    const duration = 30; // 30-minute slots
    const buffer = window.bufferTime || 10;

    for (let time = start; time < end; time += duration + buffer) {
      const slotStartTime = formatTime(time);
      const slotEndTime = formatTime(time + duration);
      const slotId = `slot_${window.dayOfWeek}_${slotStartTime.replace(':', '')}`;

      // Check if slot is already booked
      const slotKey = `booking:slot:${slotId}:${date}`;
      const existingBooking = await kv.get(slotKey);
      const available = !existingBooking || !existingBooking.value;

      slots.push({
        slotId,
        date,
        dayOfWeek: window.dayOfWeek,
        startTime: slotStartTime,
        endTime: slotEndTime,
        available,
        bufferTime: buffer
      });
    }
  }

  return slots;
}

/**
 * Find alternative slots when conflict occurs
 */
async function findAlternativeSlots(staffId: string, date: string) {
  try {
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    const slotsData = await kv.getByPrefix(`staff:${staffId}:availability:`);
    const daySlots = slotsData
      .filter((item: any) => item.value && item.value.dayOfWeek === dayOfWeek && item.value.isActive)
      .map((item: any) => item.value);

    const timeSlots = await generateTimeSlots(daySlots, staffId, date);
    
    // Return only available slots
    return timeSlots
      .filter(slot => slot.available)
      .slice(0, 3); // Return up to 3 alternatives

  } catch (error) {
    console.error('Error finding alternative slots:', error);
    return [];
  }
}

function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function calculateEndTime(startTime: string, duration: number): string {
  const start = parseTime(startTime);
  return formatTime(start + duration);
}

export default app;
