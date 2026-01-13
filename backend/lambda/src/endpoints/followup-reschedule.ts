/**
 * ============================================================================
 * FOLLOW-UP & RESCHEDULE ENDPOINTS
 * ============================================================================
 * 
 * Handles:
 * - Follow-up appointment creation
 * - Reschedule policy retrieval
 * - Available slots for rescheduling
 * 
 * Date: 2026-01-12
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, query } from '../database/rds-connection';

export function registerFollowupRescheduleEndpoints(app: Hono) {
  /**
   * POST /followup/create
   * Create a follow-up appointment based on an original booking
   */
  app.post("/followup/create", async (c) => {
    try {
      const body = await c.req.json();
      const {
        originalBookingId,
        customerPhone,
        vendorId,
        vendorPhone,
        serviceId,
        selectedDate,
        selectedTime,
        petId,
        address,
        serviceStyle = 'at_center'
      } = body;

      if (!originalBookingId || !customerPhone || !vendorId || !selectedDate || !selectedTime) {
        return c.json({ 
          error: 'originalBookingId, customerPhone, vendorId, selectedDate, and selectedTime are required' 
        }, 400);
      }

      // Find customer by phone
      const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
      const customerResult = await query(
        `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
        [cleanPhone]
      );
      if (customerResult.rows.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }
      const customerId = customerResult.rows[0].id;

      // Verify original booking exists
      const originalBookingResult = await query(
        `SELECT * FROM bookings WHERE id::text = $1::text LIMIT 1`,
        [originalBookingId]
      );
      if (originalBookingResult.rows.length === 0) {
        return c.json({ error: 'Original booking not found' }, 404);
      }

      const originalBooking = originalBookingResult.rows[0];

      // Verify vendor exists
      const vendorResult = await query(
        `SELECT * FROM vendors WHERE id::text = $1::text LIMIT 1`,
        [vendorId]
      );
      if (vendorResult.rows.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Check slot availability
      const existingBookings = await query(
        `SELECT id FROM bookings 
         WHERE vendor_id::text = $1::text 
         AND booking_date = $2 
         AND booking_time = $3 
         AND status NOT IN ('cancelled', 'no_show', 'rescheduled')`,
        [vendorId, selectedDate, selectedTime]
      );

      if (existingBookings.rows.length > 0) {
        return c.json({ error: 'Time slot is already booked' }, 409);
      }

      // Create follow-up booking
      const newBooking = await insert('bookings', {
        customer_id: customerId,
        vendor_id: vendorId,
        service_id: serviceId || originalBooking.service_id,
        booking_date: selectedDate,
        booking_time: selectedTime,
        service_type: serviceStyle,
        address: address || originalBooking.address || null,
        status: 'confirmed',
        payment_status: 'pending',
        base_price: originalBooking.base_price || 0,
        total_amount: originalBooking.total_amount || 0,
        notes: `Follow-up appointment for booking ${originalBookingId}`,
        metadata: {
          is_followup: true,
          original_booking_id: originalBookingId
        }
      });

      return c.json({
        success: true,
        message: 'Follow-up appointment created successfully',
        booking: newBooking[0],
      });
    } catch (error: any) {
      console.error('Error creating follow-up appointment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/reschedule-policy
   * Get reschedule policy for a booking
   */
  app.get("/vendor/reschedule-policy", async (c) => {
    try {
      const bookingId = c.req.query('bookingId');

      if (!bookingId) {
        return c.json({ error: 'bookingId is required' }, 400);
      }

      // Get booking details
      const bookingResult = await query(
        `SELECT * FROM bookings WHERE id::text = $1::text LIMIT 1`,
        [bookingId]
      );
      if (bookingResult.rows.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookingResult.rows[0];

      // Get vendor
      const vendorResult = await query(
        `SELECT * FROM vendors WHERE id::text = $1::text LIMIT 1`,
        [booking.vendor_id]
      );
      if (vendorResult.rows.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendorResult.rows[0];

      // Calculate time until booking
      const bookingDate = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const now = new Date();
      const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Default policy
      const policy = {
        allowsReschedule: hoursUntilBooking > 24, // Can reschedule if more than 24 hours away
        minHoursNotice: 24,
        maxReschedules: 2,
        cancellationFee: hoursUntilBooking < 24 ? (booking.total_amount * 0.1) : 0, // 10% fee if less than 24h
        refundPolicy: hoursUntilBooking > 48 ? 'full' : hoursUntilBooking > 24 ? 'partial' : 'none',
        message: hoursUntilBooking > 24 
          ? 'You can reschedule this appointment free of charge'
          : hoursUntilBooking > 0
          ? `Rescheduling within 24 hours incurs a ${(booking.total_amount * 0.1).toFixed(2)} cancellation fee`
          : 'This appointment cannot be rescheduled as it has already passed'
      };

      // Check vendor-specific policy if exists
      if (vendor.metadata && typeof vendor.metadata === 'object') {
        const vendorPolicy = (vendor.metadata as any).reschedule_policy;
        if (vendorPolicy) {
          Object.assign(policy, vendorPolicy);
        }
      }

      return c.json({
        success: true,
        policy: policy,
      });
    } catch (error: any) {
      console.error('Error fetching reschedule policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /bookings/available-slots
   * Get available time slots for booking (customer-facing endpoint)
   */
  app.get("/bookings/available-slots", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const date = c.req.query('date');
      const serviceId = c.req.query('serviceId');
      const serviceStyle = c.req.query('serviceStyle') || 'at_center';
      const staffId = c.req.query('staffId');

      if (!vendorId || !date) {
        return c.json({ error: 'vendorId and date are required' }, 400);
      }

      // Check if vendor_schedules table exists
      const tableCheck = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'vendor_schedules'
        )`
      );
      
      let slots: any[] = [];
      
      if (tableCheck.rows[0]?.exists) {
        // Get vendor schedule for the date
        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        try {
          const scheduleResult = await query(
            `SELECT DISTINCT start_time, end_time
             FROM vendor_schedules
             WHERE vendor_id::text = $1::text
             AND day_of_week = $2
             AND is_available = true
             ${staffId ? `AND staff_id::text = $3::text` : ''}
             ORDER BY start_time`,
            staffId ? [vendorId, dayOfWeek, staffId] : [vendorId, dayOfWeek]
          );

          slots = scheduleResult.rows.map((row: any) => ({
            time: row.start_time,
            available: true,
          }));
        } catch (error: any) {
          // If query fails, return default slots
          console.warn('[Available Slots] vendor_schedules query failed:', error.message);
          slots = generateDefaultSlots();
        }
      } else {
        // Table doesn't exist, return default slots
        slots = generateDefaultSlots();
      }

      return c.json({
        success: true,
        slots: slots,
        date: date,
        vendorId: vendorId,
      });
    } catch (error: any) {
      console.error('Error fetching available slots:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/available-slots
   * Get available slots for rescheduling a booking
   */
  app.get("/vendor/available-slots", async (c) => {
    try {
      const bookingId = c.req.query('bookingId');
      const date = c.req.query('date');
      const serviceStyle = c.req.query('serviceStyle') || 'at_center';

      if (!bookingId) {
        return c.json({ error: 'bookingId is required' }, 400);
      }

      // Get booking details
      const bookingResult = await query(
        `SELECT * FROM bookings WHERE id::text = $1::text LIMIT 1`,
        [bookingId]
      );
      if (bookingResult.rows.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookingResult.rows[0];
      const vendorId = booking.vendor_id;

      // If date provided, get slots for that date, otherwise get next 7 days
      const datesToCheck = date 
        ? [date]
        : Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i + 1);
            return d.toISOString().split('T')[0];
          });

      const allSlots: any[] = [];

      for (const checkDate of datesToCheck) {
        // Get vendor schedule for this date
        const requestedDate = new Date(checkDate);
        const dayOfWeek = requestedDate.getDay();

        const scheduleSlots = await query(
          `SELECT * FROM vendor_availability_v2
           WHERE vendor_id::text = $1::text
           AND day_of_week = $2
           AND service_style = $3
           AND is_enabled = true
           ORDER BY time_window_start`,
          [booking.vendor_id, dayOfWeek, serviceStyle]
        );

        // Get existing bookings for this date
        const existingBookings = await query(
          `SELECT booking_time FROM bookings
           WHERE vendor_id::text = $1::text
           AND booking_date = $2
           AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
           AND id::text != $3::text`,
          [booking.vendor_id, checkDate, bookingId]
        );

        const bookedTimes = new Set(existingBookings.rows.map((b: any) => b.booking_time));

        // Generate available slots
        for (const slot of scheduleSlots.rows) {
          const startTime = slot.time_window_start;
          const endTime = slot.time_window_end;
          
          // Generate 30-minute slots
          const slots = generateTimeSlots(startTime, endTime, 30);
          
          for (const timeSlot of slots) {
            if (!bookedTimes.has(timeSlot)) {
              allSlots.push({
                date: checkDate,
                time: timeSlot,
                available: true
              });
            }
          }
        }
      }

      return c.json({
        success: true,
        slots: allSlots,
        total: allSlots.length,
      });
    } catch (error: any) {
      console.error('Error fetching available slots:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

/**
 * Generate default time slots (9 AM to 6 PM, 30-minute intervals)
 */
function generateDefaultSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 9; hour < 18; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return slots;
}

/**
 * Generate time slots between start and end time
 */
function generateTimeSlots(startTime: string, endTime: string, intervalMinutes: number): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`);
    
    currentMin += intervalMinutes;
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60);
      currentMin = currentMin % 60;
    }
  }
  
  return slots;
}
