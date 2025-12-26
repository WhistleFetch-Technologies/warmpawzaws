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
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `services`, `staff`, `staff_availability`, `bookings` tables
 * - Uses `slot_reservations` for booking slot management
 * 
 * Date: 2025-01-28
 * Migration: Batch 9 - 9 KV operations → 0
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient } from '../../lib/db.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';

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

    // ✅ SQL: Get staff assigned to this service
    const { data: staffAssignments } = await db
      .from('staff_services')
      .select('staff_id')
      .eq('service_id', serviceId);

    const staffIds = (staffAssignments || []).map((sa: any) => sa.staff_id);

    const availability = [];

    // Load availability for each staff member
    for (const staffId of staffIds) {
      // ✅ SQL: Get staff profile
      const staff = await staffRepo.findById(staffId);
      if (!staff) continue;

      // ✅ SQL: Get availability slots for this day
      const { data: daySlots } = await db
        .from('staff_availability_slots')
        .select('*')
        .eq('staff_id', staffId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_available', true);

      if (!daySlots || daySlots.length === 0) continue;

      // Filter for tele services
      const teleSlots = daySlots.filter((slot: any) => {
        // Check if staff offers tele services for this service
        return true; // Simplified - in production, check service type
      });

      if (teleSlots.length === 0) continue;

      // Generate time slots from availability windows
      const timeSlots = await generateTimeSlots(teleSlots, staffId, date);

      availability.push({
        staffId,
        staffName: staff.fullName || staff.name,
        staffPhoto: staff.photo,
        specialization: staff.specialization || 'Veterinarian',
        rating: staff.rating || 4.5,
        reviewCount: staff.reviewCount || 0,
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

    // ✅ SQL: Check slot availability
    const { data: existingReservation } = await db
      .from('slot_reservations')
      .select('*')
      .eq('staff_id', staffId)
      .eq('reservation_date', scheduledDate)
      .eq('reservation_time', scheduledTime)
      .eq('is_active', true)
      .maybeSingle();

    if (existingReservation) {
      // Slot already booked - return 409 conflict
      const suggestedSlots = await findAlternativeSlots(staffId, scheduledDate);

      return c.json({
        error: 'Slot conflict',
        message: 'This slot was just booked by another customer',
        conflictDetails: {
          slotId,
          bookedAt: existingReservation.created_at,
          staffId
        },
        suggestedSlots
      }, 409);
    }

    // ✅ SQL: Create booking
    const booking = await bookingsRepo.create({
      customer_id: customerId,
      staff_id: staffId,
      service_id: serviceId,
      booking_date: scheduledDate,
      booking_time: scheduledTime,
      status: 'confirmed',
      service_type: 'online',
      base_price: amount,
      total_amount: amount,
      payment_status: 'pending',
      metadata: {
        type: 'scheduled_tele',
        assignedStaffName: staffName,
        assignmentMethod: 'scheduled',
        assignedAt: new Date().toISOString(),
        duration,
        slotId
      }
    });

    // ✅ SQL: Reserve the slot
    await db
      .from('slot_reservations')
      .insert({
        vendor_id: null, // Tele booking doesn't need vendor
        staff_id: staffId,
        reservation_date: scheduledDate,
        reservation_time: scheduledTime,
        reservation_type: 'temporary',
        reserved_for_id: booking.id,
        is_active: true
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
    const buffer = 10; // Default buffer time

    for (let time = start; time < end; time += duration + buffer) {
      const slotStartTime = formatTime(time);
      const slotEndTime = formatTime(time + duration);
      const slotId = `slot_${window.day_of_week}_${slotStartTime.replace(':', '')}`;

      // ✅ SQL: Check if slot is already booked
      const { data: existingReservation } = await db
        .from('slot_reservations')
        .select('*')
        .eq('staff_id', staffId)
        .eq('reservation_date', date)
        .eq('reservation_time', slotStartTime)
        .eq('is_active', true)
        .maybeSingle();

      const available = !existingReservation;

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
      .from('staff_availability_slots')
      .select('*')
      .eq('staff_id', staffId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_available', true);

    if (!daySlots || daySlots.length === 0) return [];

    const timeSlots = await generateTimeSlots(daySlots, staffId, date);

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

export default app;
