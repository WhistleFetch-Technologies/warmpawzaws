/**
 * ============================================================================
 * SCHEDULED TELE BOOKING - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Implements calendar-based booking with pre-assigned consultant
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.getByPrefix()`, `kv.set()` with SQL queries
 * - Uses `ServicesRepository`, `StaffRepository`, `BookingsRepository`
 * - Uses `services`, `staff`, `bookings`, `staff_availability` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 17 - KV to SQL (9 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
app.use('*', cors());

const db = getDbClient();
const servicesRepo = getServicesRepository();
const staffRepo = getStaffRepository();
const bookingsRepo = getBookingsRepository();

/**
 * GET /tele/scheduled-availability
 * Get tele availability from staff schedules
 */
app.get('/make-server-3dd53475/tele/scheduled-availability', async (c) => {
  try {
    const serviceId = c.req.query('serviceId');
    const date = c.req.query('date');

    if (!serviceId || !date) {
      return c.json({ error: 'serviceId and date are required' }, 400);
    }

    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    // ✅ SQL: Get service
    const service = await servicesRepo.findById(serviceId);
    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    // ✅ SQL: Get staff who offer this service
    const { data: staffServices } = await db
      .from('staff_services')
      .select('staff_id')
      .eq('service_id', serviceId)
      .eq('is_active', true);
    
    const staffIds = (staffServices || []).map((s: any) => s.staff_id);
    const availability = [];

    // Load availability for each staff member
    for (const staffId of staffIds) {
      // ✅ SQL: Get staff profile
      const staff = await staffRepo.findById(staffId);
      if (!staff || !staff.is_active) continue;

      // ✅ SQL: Get availability slots for this day
      const { data: availabilityData } = await db
        .from('staff_availability')
        .select('*')
        .eq('staff_id', staffId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true);
      
      const daySlots = (availabilityData || []).filter((slot: any) => 
        slot.has_tele_services || slot.allowed_service_ids?.includes(serviceId)
      );

      if (daySlots.length === 0) continue;

      // Generate time slots from availability windows
      const timeSlots = await generateTimeSlots(daySlots, staffId, date);

      availability.push({
        staffId,
        staffName: staff.name || staff.full_name,
        staffPhoto: staff.photo,
        specialization: staff.specialization || 'Veterinarian',
        rating: staff.rating || 4.5,
        reviewCount: staff.review_count || 0,
        experience: staff.experience || 0,
        languages: staff.languages || ['English'],
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
        sum + staff.slots.filter((s: any) => s.available).length, 0
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
 */
app.post('/make-server-3dd53475/bookings/scheduled-tele', async (c) => {
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

    // ✅ SQL: Check slot availability (check for existing bookings at this time)
    const { data: existingBookings } = await db
      .from('bookings')
      .select('id')
      .eq('staff_id', staffId)
      .eq('scheduled_date', scheduledDate)
      .eq('scheduled_time', scheduledTime)
      .in('status', ['confirmed', 'scheduled', 'in_progress']);
    
    if (existingBookings && existingBookings.length > 0) {
      // Slot already booked - return 409 conflict
      const suggestedSlots = await findAlternativeSlots(staffId, scheduledDate);
      
      return c.json({
        error: 'Slot conflict',
        message: 'This slot was just booked by another customer',
        conflictDetails: {
          slotId,
          bookedAt: new Date().toISOString(),
          staffId
        },
        suggestedSlots
      }, 409);
    }

    // ✅ SQL: Create booking
    const booking = await bookingsRepo.create({
      customer_id: customerId,
      vendor_id: null, // Tele bookings might not have vendor
      staff_id: staffId,
      service_id: serviceId,
      pet_id: petId,
      booking_type: 'scheduled_tele',
      status: 'confirmed',
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      duration: duration || 30,
      total_amount: amount,
      payment_status: 'pending',
      metadata: {
        type: 'scheduled_tele',
        serviceName,
        staffName,
        slotId,
        assignmentMethod: 'scheduled',
        assignedAt: new Date().toISOString()
      }
    });

    console.log(`✅ Created scheduled tele booking: ${booking.id} with pre-assigned staff: ${staffId}`);

    // ✅ SQL: Get staff details for response
    const staff = await staffRepo.findById(staffId);

    return c.json({
      success: true,
      bookingId: booking.id,
      message: 'Booking created successfully',
      booking: {
        ...booking,
        assignedStaffPhoto: staff?.photo,
        assignedStaffSpecialization: staff?.specialization
      },
      paymentRequired: true,
      paymentUrl: `https://payment.warmpawz.com/checkout/${booking.id}`
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
    const start = parseTime(window.start_time);
    const end = parseTime(window.end_time);
    const duration = 30; // 30-minute slots
    const buffer = window.buffer_time || 10;

    for (let time = start; time < end; time += duration + buffer) {
      const slotStartTime = formatTime(time);
      const slotEndTime = formatTime(time + duration);
      const slotId = `slot_${window.day_of_week}_${slotStartTime.replace(':', '')}`;

      // ✅ SQL: Check if slot is already booked
      const { data: existingBooking } = await db
        .from('bookings')
        .select('id')
        .eq('staff_id', staffId)
        .eq('scheduled_date', date)
        .eq('scheduled_time', slotStartTime)
        .in('status', ['confirmed', 'scheduled', 'in_progress'])
        .maybeSingle();
      
      const available = !existingBooking;

      slots.push({
        slotId,
        date,
        dayOfWeek: window.day_of_week,
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

    // ✅ SQL: Get availability slots for this day
    const { data: daySlots } = await db
      .from('staff_availability')
      .select('*')
      .eq('staff_id', staffId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true);

    const timeSlots = await generateTimeSlots(daySlots || [], staffId, date);
    
    // Return only available slots
    return timeSlots
      .filter((slot: any) => slot.available)
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

console.log('✅ Scheduled Tele Booking endpoints (SQL-only) registered');

export default app;

