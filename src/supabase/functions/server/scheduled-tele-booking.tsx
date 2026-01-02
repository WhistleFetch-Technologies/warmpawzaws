/**
 * CRITICAL MISSING FEATURE: Scheduled Tele Booking
 * 
 * Implements calendar-based booking with pre-assigned consultant
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { cors } from "hono/cors";
import {
  getVendorServicesRepository,
  getStaffRepository,
  getStaffAvailabilityRepository,
  getBookingsRepository,
  getDbClient
} from '../../../supabase/lib/repositories/index';

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

    // ✅ SQL: Get service and assigned staff from vendor_services table
    const servicesRepo = getVendorServicesRepository();
    const service = await servicesRepo.findById(serviceId);
    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    const staffIds = service.assigned_staff_ids || [];

    const availability = [];

    // ✅ SQL: Load availability for each staff member
    const staffRepo = getStaffRepository();
    const availabilityRepo = getStaffAvailabilityRepository();
    
    for (const staffId of staffIds) {
      const profile = await staffRepo.findById(staffId);
      if (!profile) continue;

      // ✅ SQL: Get availability slots for this day from staff_availability table
      const allSlots = await availabilityRepo.findByStaff(staffId);
      const daySlots = allSlots
        .filter((slot: any) => slot.day_of_week === dayOfWeek && slot.is_active)
        .filter((slot: any) => slot.has_tele_services || slot.allowed_service_ids?.includes(serviceId));

      if (daySlots.length === 0) continue;

      // Generate time slots from availability windows
      const timeSlots = await generateTimeSlots(daySlots, staffId, date);

      availability.push({
        staffId,
        staffName: profile.full_name || profile.name,
        staffPhoto: profile.photo,
        specialization: profile.specialization || 'Veterinarian',
        rating: profile.rating || 4.5,
        reviewCount: profile.review_count || 0,
        experience: profile.experience_years || 0,
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

    // ✅ SQL: Check slot availability in bookings table
    const bookingsRepo = getBookingsRepository();
    const db = getDbClient();
    const { data: existingBookings } = await db
      .from('bookings')
      .select('id')
      .eq('assigned_staff_id', staffId)
      .eq('booking_date', scheduledDate)
      .eq('booking_time', scheduledTime)
      .in('status', ['confirmed', 'in_progress']);
    
    if (existingBookings && existingBookings.length > 0) {
      // Slot already booked - return 409 conflict
      const suggestedSlots = await findAlternativeSlots(staffId, scheduledDate);
      
      return c.json({
        error: 'Slot conflict',
        message: 'This slot was just booked by another customer',
        conflictDetails: {
          slotId,
          staffId
        },
        suggestedSlots
      }, 409);
    }

    // ✅ SQL: Create booking in bookings table
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.create({
      customer_id: customerId,
      pet_id: petId || null,
      service_id: serviceId,
      vendor_id: null, // Will be derived from service
      booking_type: 'scheduled_tele',
      status: 'confirmed',
      assigned_staff_id: staffId,
      booking_date: scheduledDate,
      booking_time: scheduledTime,
      duration_minutes: duration,
      total_amount: amount,
      currency: 'INR',
      payment_status: 'pending'
    });
    
    const bookingId = booking.id;

    console.log(`✅ Created scheduled tele booking: ${bookingId} with pre-assigned staff: ${staffId}`);

    // ✅ SQL: Get staff details for response
    const staffRepo = getStaffRepository();
    const staffProfile = await staffRepo.findById(staffId) || {};

    return c.json({
      success: true,
      bookingId,
      message: 'Booking created successfully',
      booking: {
        ...booking,
        assignedStaffPhoto: staffProfile.photo,
        assignedStaffSpecialization: staffProfile.specialization || 'Veterinarian'
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

      // ✅ SQL: Check if slot is already booked in bookings table
      const db = getDbClient();
      const { data: existingBookings } = await db
        .from('bookings')
        .select('id')
        .eq('assigned_staff_id', staffId)
        .eq('booking_date', date)
        .eq('booking_time', slotStartTime)
        .in('status', ['confirmed', 'in_progress']);
      
      const available = !existingBookings || existingBookings.length === 0;

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

    // ✅ SQL: Get availability slots from staff_availability table
    const availabilityRepo = getStaffAvailabilityRepository();
    const allSlots = await availabilityRepo.findByStaff(staffId);
    const daySlots = allSlots
      .filter((slot: any) => slot.day_of_week === dayOfWeek && slot.is_active);

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
